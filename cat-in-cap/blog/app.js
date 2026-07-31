/* Архив блога: ванильный JS — роутинг по hash, рендер markdown, навигация. */
"use strict";

const app = document.getElementById("app");
let POSTS = null; // индекс из posts.json, отсортирован по дате (старые -> новые)
const mdCache = new Map();

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_NOM = ["январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

/* ---------------------------------------------------------------- утилиты */

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(iso, withTime) {
  const [d, t] = iso.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  let out = `${day} ${MONTHS[m - 1]} ${y}`;
  if (withTime && t) out += `, ${t}`;
  return out;
}

function tagLink(tag) {
  return `<a class="tag inline-block rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-px text-[13px] leading-5 text-slate-500 dark:text-slate-400 whitespace-nowrap hover:text-sky-700 dark:hover:text-sky-400 hover:border-sky-700 dark:hover:border-sky-400 hover:no-underline" href="#/tag/${encodeURIComponent(tag)}">${esc(tag)}</a>`;
}

function commentsWord(n) {
  const r10 = n % 10, r100 = n % 100;
  if (r10 === 1 && r100 !== 11) return "комментарий";
  if (r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14)) return "комментария";
  return "комментариев";
}

/* ------------------------------------------------------- markdown-рендерер */

const INLINE_RULES = [
  // картинки до ссылок
  [/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) =>
    `<img class="max-w-full h-auto rounded-md bg-white" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.closest('figure,p,div').classList.add('img-missing'); this.remove()">`],
  [/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) =>
    `<a class="text-sky-700 dark:text-sky-400 hover:underline" href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`],
  [/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>"],
  [/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>"],
  [/~~([^~\n]+)~~/g, "<s>$1</s>"],
  // голые ссылки (не внутри атрибутов — после esc и подстановок выше «сырых» url в тегах нет)
  [/(^|[\s(>])(https?:\/\/[^\s<)]+)/g, (m, pre, url) =>
    `${pre}<a class="text-sky-700 dark:text-sky-400 hover:underline" href="${url}" target="_blank" rel="noopener">${url}</a>`],
];

function inline(text) {
  let s = esc(text);
  for (const [re, sub] of INLINE_RULES) s = s.replace(re, sub);
  return s;
}

// Разрешённые iframe (YouTube, Google Docs) из исходных постов
function safeIframe(line) {
  const src = line.match(/src="([^"]+)"/);
  if (!src) return null;
  const url = src[1].replace(/^http:/, "https:");
  if (!/^(https:)?\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|docs\.google\.com)\//.test(url)) return null;
  return `<div class="embed my-6"><iframe class="w-full aspect-video rounded-md border-0" src="${esc(url)}" loading="lazy" allowfullscreen></iframe></div>`;
}

function renderMarkdown(md) {
  const lines = md.split("\n");
  const out = [];
  let para = [];

  const flush = () => {
    if (!para.length) return;
    // абзац из одной картинки -> figure (+ подпись курсивом следующей строкой)
    if (para.length <= 2 && /^!\[[^\]]*\]\([^)]+\)$/.test(para[0].trim())) {
      const img = inline(para[0].trim());
      const cap = para[1] ? `<figcaption class="mt-1.5 text-sm italic text-slate-500 dark:text-slate-400">${inline(para[1].trim().replace(/^\*|\*$/g, ""))}</figcaption>` : "";
      out.push(`<figure class="my-6 text-center">${img}${cap}</figure>`);
    } else {
      out.push(`<p>${para.map(l => inline(l)).join("<br>")}</p>`);
    }
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { flush(); continue; }

    const h = t.match(/^(#{2,4})\s+(.*)/);
    if (h) {
      flush();
      const lvl = h[1].length;
      const size = lvl === 2 ? "text-2xl" : lvl === 3 ? "text-xl" : "text-lg";
      out.push(`<h${lvl} class="mt-8 mb-2 font-semibold ${size}">${inline(h[2])}</h${lvl}>`);
      continue;
    }

    if (t.startsWith(">")) {
      flush();
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      out.push(`<blockquote class="my-4 px-4 py-0.5 border-l-[3px] border-sky-700 dark:border-sky-400 bg-slate-100 dark:bg-slate-800 rounded-r-md">${renderMarkdown(quote.join("\n"))}</blockquote>`);
      continue;
    }

    if (t.startsWith("<iframe")) {
      flush();
      const frame = safeIframe(t);
      if (frame) out.push(frame);
      continue;
    }

    para.push(line);
  }
  flush();
  return out.join("\n");
}

/* --------------------------------------------------- разбор markdown-файла */

function parsePost(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {};
  let body = md;
  if (m) {
    body = md.slice(m[0].length);
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) { try { meta[kv[1]] = JSON.parse(kv[2]); } catch { meta[kv[1]] = kv[2]; } }
    }
  }
  const idx = body.indexOf("<!-- comments -->");
  let text = body, comments = [];
  if (idx !== -1) {
    text = body.slice(0, idx);
    const rest = body.slice(idx).replace(/<!-- comments -->/, "").replace(/^\s*## Комментарии\s*/m, "");
    // комментарии разделены заголовками "### Автор · дата"
    for (const chunk of rest.split(/^### /m)) {
      if (!chunk.trim()) continue;
      const nl = chunk.indexOf("\n");
      const header = chunk.slice(0, nl === -1 ? undefined : nl).trim();
      const bodyText = nl === -1 ? "" : chunk.slice(nl + 1).trim();
      const [author, date] = header.split(" · ");
      comments.push({ author: author || "Аноним", date: date || "", text: bodyText });
    }
  }
  return { meta, text, comments };
}

async function fetchPost(info) {
  let md = mdCache.get(info.file);
  if (!md) {
    const res = await fetch("posts/" + encodeURIComponent(info.file));
    if (!res.ok) return null;
    md = await res.text();
    mdCache.set(info.file, md);
  }
  return parsePost(md);
}

/* ------------------------------ список постов: поиск, сортировка, теги --- */

let sortMode = localStorage.getItem("sort") === "comments" ? "comments" : "date";
let viewMode = "feed"; // лента всегда по умолчанию (выбор не запоминается)

// Метаданные поста: дата (опц. со временем), опц. счётчик комментариев, теги.
function postMetaHTML(p, { time = false, count = false } = {}) {
  return `<div class="post-meta mt-0.5 flex flex-wrap gap-x-3 gap-y-1.5 items-baseline text-slate-500 dark:text-slate-400 text-sm">
    <span>${fmtDate(p.date, time)}</span>
    ${count && p.comments ? `<span class="whitespace-nowrap">${p.comments} ${commentsWord(p.comments)}</span>` : ""}
    ${p.tags.map(tagLink).join("")}
  </div>`;
}

function postItemHTML(p) {
  return `<li class="post-item py-2.5 border-b border-slate-200 dark:border-slate-700">
    <a class="post-link text-xl font-semibold text-slate-800 dark:text-slate-100 hover:text-sky-700 dark:hover:text-sky-400 hover:no-underline" href="#/post/${p.slug}">${esc(p.title)}</a>
    ${postMetaHTML(p, { count: true })}
  </li>`;
}

function orderPosts(posts) {
  if (sortMode === "comments")
    return [...posts].sort((a, b) => b.comments - a.comments || b.date.localeCompare(a.date));
  return [...posts].reverse(); // по дате, от новых к старым
}

const YEAR_CLS = "year text-2xl font-semibold text-slate-500 dark:text-slate-400 tabular-nums mt-[30px] mb-2.5";
const UL_CLS = "post-list list-none m-0 p-0";

function listHTML(posts) {
  if (!posts.length) return `<p class="text-slate-500 dark:text-slate-400">Ничего не нашлось.</p>`;
  if (sortMode === "comments")
    return `<ul class="${UL_CLS}">${orderPosts(posts).map(postItemHTML).join("")}</ul>`;
  // по дате — с группировкой по годам
  let html = "", year = "";
  for (const p of orderPosts(posts)) {
    const y = p.date.slice(0, 4);
    if (y !== year) {
      if (year) html += "</ul>";
      html += `<h2 class="${YEAR_CLS}">${y}</h2><ul class="${UL_CLS}">`;
      year = y;
    }
    html += postItemHTML(p);
  }
  return html + (year ? "</ul>" : "");
}

/* --- лента: раскрытые посты, подгружаются порциями по мере прокрутки --- */

function feedArticleHTML(info, parsed) {
  const cc = info.comments
    ? `${info.comments} ${commentsWord(info.comments)} →`
    : "Перейти к посту →";
  return `<article class="feed-post max-w-[680px] pt-7 pb-8 first:pt-2 border-b border-slate-200 dark:border-slate-700">
    <h2 class="feed-title text-[26px] font-semibold leading-[1.2] mb-1.5"><a class="text-slate-800 dark:text-slate-100 hover:text-sky-700 dark:hover:text-sky-400 hover:no-underline" href="#/post/${info.slug}">${esc(info.title)}</a></h2>
    ${postMetaHTML(info, { time: true })}
    <div class="post-body mt-[18px]">${renderMarkdown(parsed.text)}</div>
    <a class="feed-comments inline-block mt-[18px] text-[15px] font-semibold text-sky-700 dark:text-sky-400 hover:underline" href="#/post/${info.slug}">${cc}</a>
  </article>`;
}

let feedGen = 0;

function renderFeed(posts, container) {
  const gen = ++feedGen;
  if (!posts.length) { container.innerHTML = `<p class="empty">Ничего не нашлось.</p>`; return; }
  const ordered = orderPosts(posts);
  container.innerHTML = `<div class="feed"></div><div class="feed-sentinel h-px"></div>`;
  const feed = container.querySelector(".feed");
  const sentinel = container.querySelector(".feed-sentinel");
  let idx = 0, loading = false;
  const BATCH = 6;

  const loadMore = async () => {
    if (loading || idx >= ordered.length) return;
    loading = true;
    const slice = ordered.slice(idx, idx + BATCH);
    const parsed = await Promise.all(slice.map(fetchPost));
    if (gen !== feedGen) return; // лента пересоздана — отбрасываем
    feed.insertAdjacentHTML("beforeend",
      slice.map((info, k) => parsed[k] ? feedArticleHTML(info, parsed[k]) : "").join(""));
    idx += slice.length;
    loading = false;
    if (idx >= ordered.length) { obs.disconnect(); sentinel.remove(); }
  };

  const obs = new IntersectionObserver(
    es => { if (es.some(e => e.isIntersecting)) loadMore(); },
    { rootMargin: "800px" }
  );
  obs.observe(sentinel);
  loadMore();
}

function tagsAsideHTML(activeTag) {
  const counts = new Map();
  for (const p of POSTS)
    for (const t of p.tags) counts.set(t, (counts.get(t) || 0) + 1);
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"));
  const row = "flex justify-between gap-2 px-2.5 py-[3px] rounded-lg text-slate-800 dark:text-slate-100 hover:text-sky-700 dark:hover:text-sky-400 hover:no-underline";
  const count = n => `<span class="tag-count opacity-60 text-[0.85em]">${n}</span>`;
  return `<h2 class="text-sm uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 mt-2 mb-2 ml-2.5 max-[720px]:hidden">Теги</h2>
    <ul class="tag-list list-none m-0 p-0 text-sm">
    <li><a class="${row} ${activeTag ? "" : "active"}" href="#/">Все посты ${count(POSTS.length)}</a></li>` +
    tags.map(([t, n]) =>
      `<li><a class="${row} ${t === activeTag ? "active" : ""}" href="#/tag/${encodeURIComponent(t)}">${esc(t)} ${count(n)}</a></li>`
    ).join("") + `</ul>`;
}

function viewList(tag) {
  if (tag && !POSTS.some(p => p.tags.includes(tag))) return notFound();
  document.title = tag ? `${tag} — Блог Ольги Коноваловой` : "Блог Ольги Коноваловой";
  const pill = "inline-flex items-center h-9 rounded-full border border-slate-200 dark:border-slate-700 px-4 text-sm text-slate-500 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 hover:border-sky-700 dark:hover:border-sky-400";
  const tab = "flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 py-2 text-[15px] text-slate-500 dark:text-slate-400";
  app.innerHTML = `<div class="layout grid grid-cols-1 wide:grid-cols-[minmax(0,1fr)_220px] wide:gap-8 items-start" data-tab="posts">
    <div class="mobile-tabs flex gap-2 mb-3.5 wide:hidden">
      <button type="button" data-tab="posts" class="active ${tab}">Посты</button>
      <button type="button" data-tab="tags" class="${tab}">Теги</button>
    </div>
    <section class="list-col">
      <div class="list-controls flex flex-wrap gap-3 items-center mb-2.5 wide:gap-8">
        <input id="search" type="search" placeholder="Найти" autocomplete="off"
          class="flex-1 min-w-[200px] h-9 px-4 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-[15px]">
        <div class="sort flex gap-1.5 items-center" id="sort">
          <span class="text-slate-500 dark:text-slate-400 text-sm">Сортировка:</span>
          <button type="button" data-sort="date" class="${pill}">по дате</button>
          <button type="button" data-sort="comments" class="${pill}">по комментариям</button>
        </div>
        <div class="sort flex gap-1.5 items-center" id="view">
          <span class="text-slate-500 dark:text-slate-400 text-sm">Вид:</span>
          <button type="button" data-view="feed" class="${pill}">лента</button>
          <button type="button" data-view="list" class="${pill}">список</button>
        </div>
      </div>
      ${tag ? `<h1 class="tag-title text-[26px] font-semibold mt-4 mb-1">Тег «${esc(tag)}»</h1>` : ""}
      <div id="list"></div>
    </section>
    <aside class="tags-col wide:sticky wide:top-4 wide:max-h-[calc(100vh-32px)] wide:overflow-y-auto">${tagsAsideHTML(tag)}</aside>
  </div>`;

  const base = tag ? POSTS.filter(p => p.tags.includes(tag)) : POSTS;
  const input = document.getElementById("search");

  const listEl = document.getElementById("list");
  const render = () => {
    const tokens = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    const posts = tokens.length
      ? base.filter(p => tokens.every(t => p.search.includes(t)))
      : base;
    if (viewMode === "feed") renderFeed(posts, listEl);
    else { feedGen++; listEl.innerHTML = listHTML(posts); }
    for (const b of document.querySelectorAll("#sort button"))
      b.classList.toggle("active", b.dataset.sort === sortMode);
    for (const b of document.querySelectorAll("#view button"))
      b.classList.toggle("active", b.dataset.view === viewMode);
  };

  // мобильные табы «Посты | Теги»
  const layout = app.querySelector(".layout");
  layout.querySelector(".mobile-tabs").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    layout.dataset.tab = b.dataset.tab;
    for (const t of layout.querySelectorAll(".mobile-tabs button"))
      t.classList.toggle("active", t === b);
  });

  input.addEventListener("input", render);
  document.getElementById("sort").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    sortMode = b.dataset.sort;
    localStorage.setItem("sort", sortMode);
    render();
  });
  document.getElementById("view").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || b.dataset.view === viewMode) return;
    viewMode = b.dataset.view;
    render();
  });
  render();
  placeSearch();
}

/* Поиск: на десктопе живёт над тегами в правой колонке, на мобильной —
   в строке управления над списком. Переносим тот же input в DOM (его
   обработчики при перемещении сохраняются). */
const SEARCH_DESKTOP = matchMedia("(min-width: 721px)");
function placeSearch() {
  const search = document.getElementById("search");
  if (!search) return;
  const target = SEARCH_DESKTOP.matches
    ? app.querySelector(".tags-col")
    : app.querySelector(".list-controls");
  if (target && search.parentElement !== target) target.prepend(search);
}
SEARCH_DESKTOP.addEventListener("change", placeSearch);

async function viewPost(slug) {
  const i = POSTS.findIndex(p => p.slug === slug);
  if (i === -1) return notFound();
  const info = POSTS[i];
  document.title = `${info.title} — Блог Ольги Коноваловой`;

  const parsed = await fetchPost(info);
  if (!parsed) return notFound();
  const { text, comments } = parsed;

  const prev = POSTS[i - 1]; // более старый
  const next = POSTS[i + 1]; // более новый

  let html = `<article class="post max-w-read mx-auto">
    <h1 class="text-[33px] font-semibold leading-[1.15] tracking-[-0.01em] mb-1.5">${esc(info.title)}</h1>
    ${postMetaHTML(info, { time: true })}
    <div class="post-body mt-[22px]">${renderMarkdown(text)}</div>
  </article>`;

  if (comments.length) {
    html += `<section class="comments max-w-read mx-auto mt-11 pt-2 border-t-2 border-slate-200 dark:border-slate-700">
      <h2 class="text-[22px] font-semibold">Комментарии <span class="text-slate-500 dark:text-slate-400 font-normal text-base">${comments.length}</span></h2>` +
      comments.map(c => `
        <div class="comment bg-slate-100 dark:bg-slate-800 rounded-[10px] px-4 py-3 my-3">
          <div class="flex gap-2.5 items-baseline mb-1">
            <span class="font-semibold">${esc(c.author)}</span>
            ${c.date ? `<span class="text-slate-500 dark:text-slate-400 text-[13px]">${fmtDate(c.date, true)}</span>` : ""}
          </div>
          <div class="comment-body">${renderMarkdown(c.text)}</div>
        </div>`).join("") +
      `</section>`;
  }

  html += `<nav class="post-nav max-w-read mx-auto flex justify-between gap-4 mt-9 pt-4 border-t border-slate-200 dark:border-slate-700 text-[15px]">
    <div>${prev ? `<a class="text-sky-700 dark:text-sky-400 hover:underline" href="#/post/${prev.slug}">← ${esc(prev.title)}</a>` : ""}</div>
    <div class="text-right">${next ? `<a class="text-sky-700 dark:text-sky-400 hover:underline" href="#/post/${next.slug}">${esc(next.title)} →</a>` : ""}</div>
  </nav>`;

  app.innerHTML = html;
}

function notFound() {
  document.title = "Не найдено — Блог Ольги Коноваловой";
  app.innerHTML = `<h1 class="text-3xl font-semibold mb-2">Страница не найдена</h1><p><a class="text-sky-700 dark:text-sky-400 hover:underline" href="#/">На главную</a></p>`;
}

/* ----------------------------------------------------------------- роутер */

function route() {
  if (!POSTS) return;
  const hash = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [page, ...rest] = hash.split("/");
  const arg = rest.join("/");
  if (!page) viewList(null);
  else if (page === "post" && arg) viewPost(arg);
  else if (page === "tag" && arg) viewList(arg);
  else if (page === "tags") viewList(null);
  else notFound();
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);

/* ------------------------------------------------------ переключатель темы */

document.getElementById("theme-toggle").addEventListener("click", () => {
  const next = !document.documentElement.classList.contains("dark");
  const system = matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", next);
  if (next === system) localStorage.removeItem("theme"); // как система — авто-режим
  else localStorage.setItem("theme", next ? "dark" : "light");
});

fetch("posts.json")
  .then(r => r.json())
  .then(data => {
    // строка для мгновенного поиска: название, теги, месяц (оба падежа), год
    for (const p of data) {
      const [y, m] = p.date.split("-");
      p.search = `${p.title} ${p.tags.join(" ")} ${MONTHS[m - 1]} ${MONTHS_NOM[m - 1]} ${y} ${p.date.slice(0, 10)}`.toLowerCase();
    }
    POSTS = data;
    route();
  })
  .catch(() => { app.innerHTML = "<p>Не удалось загрузить список постов.</p>"; });
