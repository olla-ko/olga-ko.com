// Сервер админки olga-ko.com.
//
// Два режима хранения:
//  - GitHub (продакшен на Railway): GITHUB_TOKEN задан — файлы читаются/пишутся
//    через GitHub API; публикация = коммит в main (деплоит существующий CI),
//    черновики = ветка drafts.
//  - Локальный (разработка): GITHUB_TOKEN не задан — читаем/пишем рабочее дерево
//    репозитория напрямую (../), черновики отключены.
//
// Сайт от этого сервера не зависит: это слой НАД репозиторием.
const path = require("path");
const fs = require("fs");
const express = require("express");
const cookieSession = require("cookie-session");
const bake = require("../lib/bake.js");
const { isValidTarget, saveDecision } = require("./lib/save.js");
const { computeHasDraft } = require("./lib/drafts.js");
const { buildVersionList, dedupeVersions, checkDeletable, planVersionDeletion } = require("./lib/versions.js");
const {
  isCommitsTruncated, isFilesTruncated, aheadShas, changedFilesAhead, isReachableFromMain,
} = require("./lib/compare.js");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const [OWNER, REPO] = (process.env.GITHUB_REPO || "nkonovalov1990/olga-ko.com").split("/");
const MAIN = "main";
const DRAFTS = "drafts";
const MODE = GITHUB_TOKEN ? "github" : "local";
const REPO_ROOT = path.resolve(__dirname, "..");

if (!ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD не задан — сервер не стартует без пароля.");
  process.exit(1);
}

// ---------- статический каталог редактируемого ----------
const STATIC_FILES = [
  { path: "content/portfolio-ru.md", type: "portfolio", lang: "ru", title: "Портфолио (RU)", group: "Портфолио" },
  { path: "content/portfolio-en.md", type: "portfolio", lang: "en", title: "Портфолио (EN)", group: "Портфолио" },
  { path: "content/cv-ru.md", type: "cv", lang: "ru", title: "Резюме (RU)", group: "Резюме" },
  { path: "content/cv-en.md", type: "cv", lang: "en", title: "Резюме (EN)", group: "Резюме" },
];
// md-страницы находятся динамически по src/pages/*.njk (frontmatter mdSource) —
// созданные через админку страницы попадают в список сами.

// ---------- бэкенды хранения ----------
let octokit = null;
async function gh() {
  if (!octokit) {
    const { Octokit } = await import("@octokit/rest");
    octokit = new Octokit({ auth: GITHUB_TOKEN });
  }
  return octokit;
}

const storage = {
  async listDir(dir, ref = MAIN) {
    if (MODE === "local") {
      const p = path.join(REPO_ROOT, dir);
      return fs.existsSync(p) ? fs.readdirSync(p) : [];
    }
    const api = await gh();
    const { data } = await api.repos.getContent({ owner: OWNER, repo: REPO, path: dir, ref });
    return Array.isArray(data) ? data.map((f) => f.name) : [];
  },

  async read(filePath, ref = MAIN) {
    if (MODE === "local") {
      const p = path.join(REPO_ROOT, filePath);
      if (!fs.existsSync(p)) return null;
      return { content: fs.readFileSync(p, "utf-8"), sha: null };
    }
    const api = await gh();
    try {
      const { data } = await api.repos.getContent({ owner: OWNER, repo: REPO, path: filePath, ref });
      return { content: Buffer.from(data.content, "base64").toString("utf-8"), sha: data.sha };
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  },

  async write(filePath, content, { branch, sha, message }) {
    if (MODE === "local") {
      fs.writeFileSync(path.join(REPO_ROOT, filePath), content, "utf-8");
      return { sha: null };
    }
    const api = await gh();
    const { data } = await api.repos.createOrUpdateFileContents({
      owner: OWNER, repo: REPO, path: filePath, branch,
      message, content: Buffer.from(content, "utf-8").toString("base64"),
      ...(sha ? { sha } : {}),
    });
    return { sha: data.content.sha };
  },

  async ensureDraftsBranch() {
    const api = await gh();
    try {
      await api.repos.getBranch({ owner: OWNER, repo: REPO, branch: DRAFTS });
    } catch (e) {
      if (e.status !== 404) throw e;
      const { data: main } = await api.repos.getBranch({ owner: OWNER, repo: REPO, branch: MAIN });
      await api.git.createRef({ owner: OWNER, repo: REPO, ref: `refs/heads/${DRAFTS}`, sha: main.commit.sha });
    }
  },

  // скаффолд: несколько файлов одним коммитом в main (Git Data API)
  async commitFiles(files, message) {
    if (MODE === "local") {
      for (const f of files) {
        const p = path.join(REPO_ROOT, f.path);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, f.content, "utf-8");
      }
      return;
    }
    const api = await gh();
    const { data: refData } = await api.git.getRef({ owner: OWNER, repo: REPO, ref: `heads/${MAIN}` });
    const baseSha = refData.object.sha;
    const { data: baseCommit } = await api.git.getCommit({ owner: OWNER, repo: REPO, commit_sha: baseSha });
    const { data: tree } = await api.git.createTree({
      owner: OWNER, repo: REPO, base_tree: baseCommit.tree.sha,
      tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
    });
    const { data: commit } = await api.git.createCommit({
      owner: OWNER, repo: REPO, message, tree: tree.sha, parents: [baseSha],
    });
    await api.git.updateRef({ owner: OWNER, repo: REPO, ref: `heads/${MAIN}`, sha: commit.sha });
  },
};

// каталог: статика + динамически найденные md-страницы.
// Кэш в памяти: структура меняется только при scaffold, бейджи — при save;
// оба сбрасывают кэш явно, TTL — страховка от правок мимо админки.
let catalogCache = { at: 0, files: null };
const CATALOG_TTL = 60 * 1000;
function invalidateCatalog() {
  catalogCache = { at: 0, files: null };
}

async function catalogBase() {
  if (catalogCache.files && Date.now() - catalogCache.at < CATALOG_TTL) return catalogCache.files;
  const files = STATIC_FILES.map((f) => ({ ...f }));
  const pageFiles = (await storage.listDir("src/pages")).filter((n) => n.endsWith(".njk"));
  for (const name of pageFiles) {
    const tpl = await storage.read(`src/pages/${name}`);
    const m = tpl && tpl.content.match(/mdSource:\s*"([^"]+)"/);
    if (m) {
      const slug = name.replace(/\.njk$/, "");
      const dir = m[1].replace(/content\.md$/, "");
      files.push({ path: m[1], type: "single", pagePath: dir, title: slug, group: "Страницы" });
    }
  }
  catalogCache = { at: Date.now(), files };
  return files;
}

async function getCatalog(withDrafts) {
  const files = (await catalogBase()).map((f) => ({ ...f }));
  if (withDrafts && MODE === "github") {
    await storage.ensureDraftsBranch();
    const api = await gh();
    const treeOf = async (ref) => {
      const { data } = await api.git.getTree({ owner: OWNER, repo: REPO, tree_sha: ref, recursive: "true" });
      return new Map(data.tree.filter((t) => t.type === "blob").map((t) => [t.path, t.sha]));
    };
    const [mainTree, draftTree, cmp] = await Promise.all([
      treeOf(MAIN),
      treeOf(DRAFTS),
      api.repos.compareCommitsWithBasehead({ owner: OWNER, repo: REPO, basehead: `${MAIN}...${DRAFTS}` }),
    ]);
    // Правила бейджа «не опубликовано» — в admin/lib/drafts.js
    const hasDraft = computeHasDraft({
      paths: files.map((f) => f.path),
      mainTree,
      draftTree,
      changedAheadInDrafts: changedFilesAhead(cmp.data),
      truncated: isFilesTruncated(cmp.data),
    });
    for (const f of files) f.hasDraft = hasDraft.get(f.path);
  }
  return files;
}

function isAllowed(filePath, catalog) {
  return catalog.some((f) => f.path === filePath);
}

// ---------- превью: тот же bake, что собирает прод ----------
// Ассеты (css/картинки) отдаёт сама админка (/site/... ниже) — превью не зависит
// от состояния деплоя боевого сайта.
function previewHtml(origin, { type, lang = "ru", md = "", pagePath = "big-library/" }) {
  let base, body;
  if (type === "portfolio") {
    base = `${origin}/site/portfolio-${lang}/`;
    body = `<body class="portfolio-page"><div class="wrapper">
      <div class="portfolio" id="portfolio" style="display:flex;opacity:1">${bake.portfolioCardsFromString(md, lang === "en")}</div>
    </div></body>`;
  } else if (type === "cv") {
    base = `${origin}/site/portfolio-${lang}/`;
    body = `<body class="portfolio-page"><div class="wrapper">
      <div class="cv" id="cv" style="display:flex;opacity:1">${bake.cvJobsFromString(md)}</div>
    </div></body>`;
  } else {
    base = `${origin}/site/${pagePath}`;
    body = `<body class="md-page"><div id="content" class="content">${bake.singlePageFromString(md)}</div></body>`;
  }
  return `<!DOCTYPE html><html lang="${lang}"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="${base}">
    <link rel="preconnect" href="https://rsms.me/">
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
    <link rel="stylesheet" href="${origin}/site/tailwind.css">
  </head>${body}</html>`;
}

// ---------- приложение ----------
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(cookieSession({
  name: "admin",
  secret: process.env.SESSION_SECRET || ADMIN_PASSWORD,
  maxAge: 7 * 24 * 3600 * 1000,
  sameSite: "strict",
  httpOnly: true,
}));

// примитивный rate-limit логина
const loginAttempts = new Map();
app.post("/api/login", (req, res) => {
  const ip = req.ip;
  const a = loginAttempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60 * 1000) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 10) return res.status(429).json({ error: "Слишком много попыток, подождите 15 минут" });
  if (req.body.password !== ADMIN_PASSWORD) {
    a.n++; loginAttempts.set(ip, a);
    return res.status(401).json({ error: "Неверный пароль" });
  }
  loginAttempts.delete(ip);
  req.session.auth = true;
  res.json({ ok: true, mode: MODE });
});
app.post("/api/logout", (req, res) => { req.session = null; res.json({ ok: true }); });

function requireAuth(req, res, next) {
  if (!req.session || !req.session.auth) return res.status(401).json({ error: "Не авторизован" });
  // CSRF: мутации только с кастомным заголовком (не отправляется кросс-сайтово)
  if (req.method !== "GET" && req.headers["x-admin"] !== "1") return res.status(403).json({ error: "CSRF" });
  next();
}

app.get("/api/session", (req, res) =>
  res.json({ auth: Boolean(req.session && req.session.auth), mode: MODE }));

app.get("/api/files", requireAuth, async (req, res, next) => {
  try { res.json(await getCatalog(true)); } catch (e) { next(e); }
});

app.get("/api/file", requireAuth, async (req, res, next) => {
  try {
    const { path: p, ref = MAIN } = req.query;
    // ref: ветка или sha конкретного коммита (версии)
    if (!/^([0-9a-f]{7,40}|main|drafts)$/.test(ref)) return res.status(400).json({ error: "Некорректный ref" });
    const catalog = await getCatalog(false);
    if (!isAllowed(p, catalog)) return res.status(403).json({ error: "Путь вне списка редактируемых" });
    if (ref === DRAFTS && MODE === "github") await storage.ensureDraftsBranch();
    const data = await storage.read(p, MODE === "github" ? ref : MAIN);
    if (!data) return res.status(404).json({ error: "Файл не найден" });
    res.json(data);
  } catch (e) { next(e); }
});

// blob-sha файла в каждом из коммитов: одним GraphQL-запросом,
// при неудаче — фолбэк на поштучные чтения
async function fileBlobShas(p, commitShas) {
  const api = await gh();
  try {
    const fields = commitShas
      .map((s, i) => `c${i}: object(expression: "${s}:${p.replace(/"/g, '\\"')}") { ... on Blob { oid } }`)
      .join(" ");
    const { data } = await api.request("POST /graphql", {
      query: `{ repository(owner: "${OWNER}", name: "${REPO}") { ${fields} } }`,
    });
    if (data.errors) throw new Error(data.errors[0].message);
    return commitShas.map((_, i) => data.data.repository[`c${i}`]?.oid || null);
  } catch {
    return Promise.all(commitShas.map((s) => storage.read(p, s).then((d) => (d ? d.sha : null)).catch(() => null)));
  }
}

// лента версий страницы: коммиты по файлу в main + drafts, слитые по дате
app.get("/api/versions", requireAuth, async (req, res, next) => {
  try {
    if (MODE !== "github") return res.json([]);
    const { path: p } = req.query;
    const catalog = await getCatalog(false);
    if (!isAllowed(p, catalog)) return res.status(403).json({ error: "Путь вне списка редактируемых" });
    await storage.ensureDraftsBranch();
    const api = await gh();
    const listFor = async (branch) => {
      const { data } = await api.repos.listCommits({ owner: OWNER, repo: REPO, path: p, sha: branch, per_page: 30 });
      return data;
    };
    const [mainCommits, draftCommits, cmp] = await Promise.all([
      listFor(MAIN),
      listFor(DRAFTS),
      api.repos.compareCommitsWithBasehead({ owner: OWNER, repo: REPO, basehead: `${MAIN}...${DRAFTS}` }),
    ]);
    // Правила ленты — в admin/lib/versions.js
    const versions = buildVersionList({
      mainCommits,
      draftCommits,
      aheadShas: aheadShas(cmp.data),
      truncated: isCommitsTruncated(cmp.data),
    });
    const blobs = await fileBlobShas(p, versions.map((v) => v.sha));
    res.json(dedupeVersions(versions, blobs));
  } catch (e) { next(e); }
});

app.post("/api/preview", requireAuth, (req, res) => {
  const origin = `${req.protocol}://${req.get("host")}`;
  res.type("html").send(previewHtml(origin, req.body));
});

app.post("/api/save", requireAuth, async (req, res, next) => {
  try {
    const { path: p, content, sha, target = DRAFTS } = req.body;
    const catalog = await getCatalog(false);
    if (!isAllowed(p, catalog)) return res.status(403).json({ error: "Путь вне списка редактируемых" });
    if (MODE === "local") {
      await storage.write(p, content, {});
      invalidateCatalog();
      return res.json({ ok: true, mode: MODE });
    }
    if (!isValidTarget(target)) return res.status(400).json({ error: "Недопустимая ветка" });
    if (target === DRAFTS) await storage.ensureDraftsBranch();
    const current = await storage.read(p, target);
    // Оптимистичная блокировка; правила — в admin/lib/save.js. Чтение main
    // дорогое, поэтому делаем его только когда модуль об этом просит.
    const currentSha = current ? current.sha : null;
    let decision = saveDecision({ target, clientSha: sha, currentSha });
    if (decision === "need-main-sha") {
      const mainNow = await storage.read(p, MAIN);
      decision = saveDecision({
        target, clientSha: sha, currentSha,
        mainSha: mainNow ? mainNow.sha : null,
      });
    }
    if (decision === "conflict") {
      return res.status(409).json({ error: "Версия изменилась с момента загрузки — обновите страницу и повторите" });
    }
    const result = await storage.write(p, content, {
      branch: target,
      sha: current ? current.sha : undefined,
      message: `${target === MAIN ? "Publish" : "Draft"}: ${p} (via admin)`,
    });
    // после публикации синхронизируем черновик с main, чтобы бейдж погас
    if (target === MAIN) {
      await storage.ensureDraftsBranch();
      const draft = await storage.read(p, DRAFTS);
      if (draft && draft.content !== content) {
        await storage.write(p, content, { branch: DRAFTS, sha: draft.sha, message: `Sync draft after publish: ${p}` });
      }
    }
    invalidateCatalog();
    res.json({ ok: true, sha: result.sha });
  } catch (e) { next(e); }
});

// Удаление черновой версии = переписывание ветки drafts без этого коммита.
// Git хранит снапшоты, поэтому мало вырезать коммит из цепочки: если следующие
// коммиты (правки других файлов) несут тот же blob нашего файла, содержимое
// «всплывёт» в их диффе — в таких коммитах blob подменяется на предыдущий.
// main не трогаем никогда: опубликованные версии удалить нельзя.
app.post("/api/version/delete", requireAuth, async (req, res, next) => {
  try {
    if (MODE !== "github") return res.status(400).json({ error: "Версии доступны только в GitHub-режиме" });
    const { path: p, sha } = req.body;
    if (!/^[0-9a-f]{40}$/.test(sha || "")) return res.status(400).json({ error: "Некорректный sha" });
    const catalog = await getCatalog(false);
    if (!isAllowed(p, catalog)) return res.status(403).json({ error: "Путь вне списка редактируемых" });
    await storage.ensureDraftsBranch();
    const api = await gh();

    const { data: cmp } = await api.repos.compareCommitsWithBasehead({
      owner: OWNER, repo: REPO, basehead: `${MAIN}...${sha}`,
    });

    // цепочка drafts от tip до целевого коммита
    const kept = []; // коммиты новее целевого, tip → ...
    let target = null;
    for (let page = 1; page <= 5 && !target; page++) {
      const { data: commits } = await api.repos.listCommits({
        owner: OWNER, repo: REPO, sha: DRAFTS, per_page: 100, page,
      });
      if (!commits.length) break;
      for (const c of commits) {
        if (c.sha === sha) { target = c; break; }
        kept.push(c);
      }
    }
    if (!target) return res.status(404).json({ error: "Версия не найдена в ветке черновиков" });

    const { data: full } = await api.repos.getCommit({ owner: OWNER, repo: REPO, ref: sha });
    // Все гарды — в admin/lib/versions.js
    const refusal = checkDeletable({
      reachableFromMain: isReachableFromMain(cmp),
      targetCommit: target,
      kept,
      commitFiles: full.files,
      path: p,
    });
    if (refusal) return res.status(400).json({ error: refusal.error });

    const parentSha = target.parents[0].sha;
    const blobs = await fileBlobShas(p, [sha, parentSha, ...kept.map((c) => c.sha)]);

    // План пересборки (oldest → newest) считает admin/lib/versions.js,
    // здесь только выполняем его через GitHub API.
    let newParent = parentSha;
    for (const step of planVersionDeletion({ kept, blobs })) {
      let treeSha = step.treeSha;
      if (step.overrideBlob || step.removesFile) {
        const { data: tree } = await api.git.createTree({
          owner: OWNER, repo: REPO, base_tree: treeSha,
          tree: [{ path: p, mode: "100644", type: "blob", sha: step.overrideBlob }],
        });
        treeSha = tree.sha;
      }
      const { data: commit } = await api.git.createCommit({
        owner: OWNER, repo: REPO,
        message: step.commit.commit.message, tree: treeSha, parents: [newParent],
        author: step.commit.commit.author, committer: step.commit.commit.committer,
      });
      newParent = commit.sha;
    }
    await api.git.updateRef({ owner: OWNER, repo: REPO, ref: `heads/${DRAFTS}`, sha: newParent, force: true });
    invalidateCatalog();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.get("/api/deploy", requireAuth, async (req, res, next) => {
  try {
    if (MODE !== "github") return res.json({ status: "local" });
    const api = await gh();
    const { data } = await api.actions.listWorkflowRunsForRepo({
      owner: OWNER, repo: REPO, branch: MAIN, per_page: 1,
    });
    const run = data.workflow_runs[0];
    if (!run) return res.json({ status: "none" });
    res.json({ status: run.status, conclusion: run.conclusion, url: run.html_url, updatedAt: run.updated_at });
  } catch (e) { next(e); }
});

app.post("/api/scaffold", requireAuth, async (req, res, next) => {
  try {
    const { title, slug } = req.body;
    if (!/^[a-z0-9-]{2,60}$/.test(slug || "")) return res.status(400).json({ error: "Слаг: строчные латинские буквы, цифры и дефисы" });
    const catalog = await getCatalog(false);
    if (catalog.some((f) => f.path === `${slug}/content.md`)) return res.status(409).json({ error: "Такая страница уже есть" });

    const pageTpl = `---
layout: layouts/mdpage.njk
root: "../"
back: false
mdSource: "${slug}/content.md"
permalink: "/${slug}/index.html"
---
`;
    const contentTpl = `# ${title}\n\nТекст страницы…\n`;
    // пункт на разводной: перед закрытием списка «Старый блог…» — после </li> последнего элемента
    const home = await storage.read("src/pages/home.njk", MAIN);
    const anchor = `        <li>
          <a href="cat-in-cap/"`;
    const li = `        <li>
          <a href="${slug}/" class="group flex items-center justify-between gap-4 py-4">
            <span class="text-base font-medium transition-colors group-hover:text-brand">${title}</span>
            <span aria-hidden="true" class="text-brand transition-transform group-hover:translate-x-1">→</span>
          </a>
        </li>
`;
    if (!home || !home.content.includes(anchor)) return res.status(500).json({ error: "Не нашёл место для пункта на разводной" });
    const newHome = home.content.replace(anchor, li + anchor);

    await storage.commitFiles(
      [
        { path: `${slug}/content.md`, content: contentTpl },
        { path: `src/pages/${slug}.njk`, content: pageTpl },
        { path: "src/pages/home.njk", content: newHome },
      ],
      `Scaffold new page: ${slug} (via admin)`
    );
    invalidateCatalog();
    res.json({ ok: true, path: `${slug}/content.md` });
  } catch (e) { next(e); }
});

// ассеты сайта для превью (только для залогиненных)
app.use("/site", (req, res, next) => {
  if (!req.session || !req.session.auth) return res.status(401).end();
  next();
}, express.static(REPO_ROOT, { index: false, dotfiles: "ignore", fallthrough: false }));

// фронтенд (vite build → dist/)
const dist = path.join(__dirname, "dist");
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Внутренняя ошибка" });
});

app.listen(PORT, () => console.log(`admin (${MODE} mode) on :${PORT}`));
