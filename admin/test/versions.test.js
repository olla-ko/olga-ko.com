const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildVersionList,
  dedupeVersions,
  checkDeletable,
  planVersionDeletion,
} = require("../lib/versions.js");

// Заготовка коммита в том виде, в каком его отдаёт GitHub API.
const commit = (sha, date, message, opts = {}) => ({
  sha,
  parents: opts.parents || [{ sha: "parent-of-" + sha }],
  commit: {
    message,
    tree: { sha: opts.tree || "tree-" + sha },
    committer: { date },
    author: { date },
  },
});

// ---------- buildVersionList ----------

test("buildVersionList: коммиты main образуют историю на сайте", () => {
  const mainCommits = [
    commit("m2", "2026-07-06T09:00:00Z", "Publish: x (via admin)"),
    commit("m1", "2026-07-01T10:00:00Z", "правка руками"),
  ];
  const v = buildVersionList({ mainCommits, draftCommits: [], aheadShas: new Set(), truncated: false });
  assert.equal(v.length, 2);
  assert.equal(v[0].sha, "m2");
  assert.equal(v[0].isCurrent, true, "самый свежий коммит main — то, что сейчас на сайте");
  assert.equal(v[0].published, true);
  assert.equal(v[0].viaAdmin, true);
  assert.equal(v[1].isCurrent, false);
  assert.equal(v[1].viaAdmin, false, "коммит без пометки (via admin) сделан руками");
});

// Регрессия: ветку drafts когда-то влили в main через Pull Request. Её коммиты
// стали достижимы из main и перестали быть отдельными версиями файла — в ленте
// они висели «призраками», которые нельзя было ни опубликовать, ни удалить.
test("buildVersionList: коммит drafts, уже влитый в main, в ленту не попадает", () => {
  const ghost = commit("ghost", "2026-07-04T07:01:00Z", "Draft: x (via admin)");
  const v = buildVersionList({
    mainCommits: [commit("m1", "2026-07-03T11:09:00Z", "правка руками")],
    draftCommits: [ghost],
    aheadShas: new Set(), // впереди main его нет — значит он уже внутри main
    truncated: false,
  });
  assert.deepEqual(v.map((x) => x.sha), ["m1"]);
});

test("buildVersionList: настоящий черновик попадает в ленту как неопубликованный", () => {
  const v = buildVersionList({
    mainCommits: [commit("m1", "2026-07-03T11:00:00Z", "Publish: x (via admin)")],
    draftCommits: [commit("d1", "2026-07-05T12:00:00Z", "Draft: x (via admin)")],
    aheadShas: new Set(["d1"]),
    truncated: false,
  });
  assert.deepEqual(v.map((x) => x.sha), ["d1", "m1"], "сортировка по дате, свежее сверху");
  assert.equal(v[0].published, false);
  assert.equal(v[0].isCurrent, false);
  assert.equal(v[1].isCurrent, true);
});

test("buildVersionList: служебная синхронизация после публикации скрыта", () => {
  const v = buildVersionList({
    mainCommits: [],
    draftCommits: [commit("s1", "2026-07-05T12:00:00Z", "Sync draft after publish: content/x.md")],
    aheadShas: new Set(["s1"]),
    truncated: false,
  });
  assert.equal(v.length, 0);
});

test("buildVersionList: один коммит в обеих ветках не двоится", () => {
  const shared = commit("s", "2026-07-05T12:00:00Z", "Publish: x (via admin)");
  const v = buildVersionList({
    mainCommits: [shared],
    draftCommits: [shared],
    aheadShas: new Set(),
    truncated: false,
  });
  assert.equal(v.length, 1);
  assert.equal(v[0].published, true);
});

test("buildVersionList: при усечённом compare черновик определяем по отсутствию в main", () => {
  const v = buildVersionList({
    mainCommits: [commit("m1", "2026-07-01T10:00:00Z", "Publish: x (via admin)")],
    draftCommits: [commit("d1", "2026-07-05T12:00:00Z", "Draft: x (via admin)")],
    aheadShas: new Set(), // список неполон из-за усечения
    truncated: true,
  });
  assert.deepEqual(v.map((x) => x.sha), ["d1", "m1"]);
  assert.equal(v[0].published, false);
});

test("buildVersionList: пустая история — пустая лента", () => {
  const v = buildVersionList({ mainCommits: [], draftCommits: [], aheadShas: new Set(), truncated: false });
  assert.deepEqual(v, []);
});

// ---------- dedupeVersions ----------

const version = (sha, published, isCurrent = false, viaAdmin = true) => ({
  sha, published, isCurrent, viaAdmin, date: "2026-07-05T12:00:00Z", message: "m",
});

test("dedupeVersions: черновик и его публикация с тем же содержимым — одна запись", () => {
  const versions = [version("pub", true, true), version("draft", false)];
  const out = dedupeVersions(versions, ["blobA", "blobA"]);
  assert.equal(out.length, 1);
  assert.equal(out[0].published, true, "из пары остаётся опубликованная");
  assert.equal(out[0].isCurrent, true);
});

test("dedupeVersions: разное содержимое — обе версии остаются", () => {
  const out = dedupeVersions([version("a", true), version("b", false)], ["blobA", "blobB"]);
  assert.equal(out.length, 2);
});

test("dedupeVersions: откат к прежнему содержимому не схлопывается", () => {
  // X, затем Y, затем снова X — три разных события, средний коммит их разделяет
  const out = dedupeVersions(
    [version("v3", true), version("v2", true), version("v1", true)],
    ["blobX", "blobY", "blobX"]
  );
  assert.equal(out.length, 3);
});

test("dedupeVersions: неизвестный blob не схлопывается", () => {
  const out = dedupeVersions([version("a", true), version("b", false)], [null, null]);
  assert.equal(out.length, 2);
});

// ---------- checkDeletable ----------

const okArgs = {
  reachableFromMain: false,
  targetCommit: commit("t", "2026-07-05T12:00:00Z", "Draft: x (via admin)"),
  kept: [commit("k1", "2026-07-06T12:00:00Z", "Draft: y (via admin)")],
  commitFiles: [{ filename: "content/x.md" }],
  path: "content/x.md",
};

test("checkDeletable: обычный черновик удалить можно", () => {
  assert.equal(checkDeletable(okArgs), null);
});

test("checkDeletable: опубликованную версию удалять нельзя", () => {
  const r = checkDeletable({ ...okArgs, reachableFromMain: true });
  assert.match(r.error, /опубликован/i);
});

test("checkDeletable: корневой коммит удалять нельзя", () => {
  const r = checkDeletable({
    ...okArgs,
    targetCommit: { ...okArgs.targetCommit, parents: [] },
  });
  assert.match(r.error, /первый коммит/i);
});

// Регрессия: линейная пересборка ветки с merge-коммитом теряет историю второй ветки.
test("checkDeletable: merge-коммит в цепочке блокирует удаление", () => {
  const merge = commit("mg", "2026-07-06T12:00:00Z", "Merge branch", {
    parents: [{ sha: "p1" }, { sha: "p2" }],
  });
  assert.match(checkDeletable({ ...okArgs, kept: [merge] }).error, /merge/i);
  assert.match(checkDeletable({ ...okArgs, targetCommit: merge }).error, /merge/i);
});

test("checkDeletable: коммит с чужими файлами удалять нельзя", () => {
  const r = checkDeletable({
    ...okArgs,
    commitFiles: [{ filename: "content/x.md" }, { filename: "admin/server.js" }],
  });
  assert.match(r.error, /другие файлы/i);
});

// ---------- planVersionDeletion ----------

test("planVersionDeletion: порядок пересборки — от старых к новым", () => {
  const kept = [
    commit("newest", "2026-07-08T12:00:00Z", "c3"),
    commit("middle", "2026-07-07T12:00:00Z", "c2"),
  ];
  // blobs: [удаляемый, родительский, ...по одному на каждый kept]
  const steps = planVersionDeletion({ kept, blobs: ["blobX", "blobW", "other", "other"] });
  assert.deepEqual(steps.map((s) => s.commit.sha), ["middle", "newest"]);
});

test("planVersionDeletion: коммит, несущий удаляемое содержимое, получает подмену", () => {
  const kept = [commit("k1", "2026-07-08T12:00:00Z", "c")];
  const steps = planVersionDeletion({ kept, blobs: ["blobX", "blobW", "blobX"] });
  assert.equal(steps[0].overrideBlob, "blobW", "содержимое заменяется на предыдущее");
  assert.equal(steps[0].treeSha, "tree-k1");
});

test("planVersionDeletion: коммит с другим содержимым остаётся как есть", () => {
  const kept = [commit("k1", "2026-07-08T12:00:00Z", "c")];
  const steps = planVersionDeletion({ kept, blobs: ["blobX", "blobW", "blobOther"] });
  assert.equal(steps[0].overrideBlob, null);
});

test("planVersionDeletion: удаляемый коммит создавал файл — подмена на «файла нет»", () => {
  const kept = [commit("k1", "2026-07-08T12:00:00Z", "c")];
  const steps = planVersionDeletion({ kept, blobs: ["blobX", null, "blobX"] });
  assert.equal(steps[0].overrideBlob, null, "null означает удаление файла из дерева");
  assert.equal(steps[0].removesFile, true, "и это именно удаление, а не «оставить как есть»");
});

test("planVersionDeletion: нет коммитов новее — пустой план", () => {
  assert.deepEqual(planVersionDeletion({ kept: [], blobs: ["blobX", "blobW"] }), []);
});
