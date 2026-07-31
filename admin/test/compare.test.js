const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isCommitsTruncated,
  isFilesTruncated,
  aheadShas,
  changedFilesAhead,
  isReachableFromMain,
} = require("../lib/compare.js");

// Ответ GitHub compare отдаёт максимум 250 коммитов и 300 файлов. Если данные
// усечены, выводы по ним неполны — это надо замечать, иначе настоящий черновик
// молча пропадёт из интерфейса.

test("isCommitsTruncated: полный ответ — не усечён", () => {
  assert.equal(isCommitsTruncated({ total_commits: 3, commits: [{}, {}, {}] }), false);
});

test("isCommitsTruncated: коммитов больше, чем отдали — усечён", () => {
  assert.equal(isCommitsTruncated({ total_commits: 400, commits: new Array(250).fill({}) }), true);
});

test("isFilesTruncated: 300 файлов — предел, считаем усечённым", () => {
  const cmp = { total_commits: 1, commits: [{}], files: new Array(300).fill({ filename: "x" }) };
  assert.equal(isFilesTruncated(cmp), true);
});

test("isFilesTruncated: мало файлов и все коммиты на месте — не усечён", () => {
  const cmp = { total_commits: 1, commits: [{}], files: [{ filename: "a" }] };
  assert.equal(isFilesTruncated(cmp), false);
});

test("isFilesTruncated: усечение по коммитам тянет за собой и файлы", () => {
  const cmp = { total_commits: 400, commits: new Array(250).fill({}), files: [{ filename: "a" }] };
  assert.equal(isFilesTruncated(cmp), true);
});

test("isFilesTruncated: поля files может не быть", () => {
  assert.equal(isFilesTruncated({ total_commits: 1, commits: [{}] }), false);
});

test("aheadShas: множество коммитов впереди", () => {
  const s = aheadShas({ commits: [{ sha: "a" }, { sha: "b" }] });
  assert.deepEqual([...s].sort(), ["a", "b"]);
});

test("changedFilesAhead: множество изменённых путей", () => {
  const s = changedFilesAhead({ files: [{ filename: "content/x.md" }] });
  assert.ok(s.has("content/x.md"));
  assert.equal(changedFilesAhead({}).size, 0);
});

test("isReachableFromMain: identical и behind означают «уже в main»", () => {
  assert.equal(isReachableFromMain({ status: "identical" }), true);
  assert.equal(isReachableFromMain({ status: "behind" }), true);
});

test("isReachableFromMain: ahead и diverged — ещё не в main", () => {
  assert.equal(isReachableFromMain({ status: "ahead" }), false);
  assert.equal(isReachableFromMain({ status: "diverged" }), false);
});
