const test = require("node:test");
const assert = require("node:assert/strict");
const { computeHasDraft } = require("../lib/drafts.js");

// Бейдж «не опубликовано» должен гореть только при НАСТОЯЩЕМ черновике:
// содержимое на drafts отличается от main И это отличие возникло из-за правки,
// реально ушедшей вперёд в drafts.

const tree = (pairs) => new Map(Object.entries(pairs));

test("настоящий черновик: файл отличается и изменён впереди main", () => {
  const r = computeHasDraft({
    paths: ["content/a.md"],
    mainTree: tree({ "content/a.md": "blobM" }),
    draftTree: tree({ "content/a.md": "blobD" }),
    changedAheadInDrafts: new Set(["content/a.md"]),
    truncated: false,
  });
  assert.equal(r.get("content/a.md"), true);
});

// Регрессия: файл правили напрямую в main, ветка drafts просто отстала.
// Содержимое различается, но черновика нет — бейдж гореть не должен.
test("drafts отстал от main — это не черновик", () => {
  const r = computeHasDraft({
    paths: ["portfolio-ru/search-and-invitation-md/content.md"],
    mainTree: tree({ "portfolio-ru/search-and-invitation-md/content.md": "blobNew" }),
    draftTree: tree({ "portfolio-ru/search-and-invitation-md/content.md": "blobOld" }),
    changedAheadInDrafts: new Set(), // впереди main этот файл не менялся
    truncated: false,
  });
  assert.equal(r.get("portfolio-ru/search-and-invitation-md/content.md"), false);
});

test("содержимое совпадает — черновика нет", () => {
  const r = computeHasDraft({
    paths: ["content/a.md"],
    mainTree: tree({ "content/a.md": "same" }),
    draftTree: tree({ "content/a.md": "same" }),
    changedAheadInDrafts: new Set(["content/a.md"]),
    truncated: false,
  });
  assert.equal(r.get("content/a.md"), false);
});

test("файла нет на одной из веток — черновика нет", () => {
  const r = computeHasDraft({
    paths: ["content/only-main.md", "content/only-drafts.md"],
    mainTree: tree({ "content/only-main.md": "m" }),
    draftTree: tree({ "content/only-drafts.md": "d" }),
    changedAheadInDrafts: new Set(["content/only-main.md", "content/only-drafts.md"]),
    truncated: false,
  });
  assert.equal(r.get("content/only-main.md"), false);
  assert.equal(r.get("content/only-drafts.md"), false);
});

// При усечённом ответе compare список изменённых файлов неполон. Лучше показать
// лишний бейдж, чем скрыть настоящий черновик.
test("ответ compare усечён — падаем на простое сравнение содержимого", () => {
  const r = computeHasDraft({
    paths: ["content/a.md"],
    mainTree: tree({ "content/a.md": "blobM" }),
    draftTree: tree({ "content/a.md": "blobD" }),
    changedAheadInDrafts: new Set(), // неполный список
    truncated: true,
  });
  assert.equal(r.get("content/a.md"), true);
});

test("несколько файлов разом", () => {
  const r = computeHasDraft({
    paths: ["a.md", "b.md", "c.md"],
    mainTree: tree({ "a.md": "1", "b.md": "2", "c.md": "3" }),
    draftTree: tree({ "a.md": "1x", "b.md": "2", "c.md": "3x" }),
    changedAheadInDrafts: new Set(["a.md", "b.md"]),
    truncated: false,
  });
  assert.equal(r.get("a.md"), true);   // отличается и впереди
  assert.equal(r.get("b.md"), false);  // впереди, но содержимое то же
  assert.equal(r.get("c.md"), false);  // отличается, но не впереди
});
