const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidTarget, saveDecision } = require("../lib/save.js");

test("isValidTarget: разрешены только main и drafts", () => {
  assert.equal(isValidTarget("main"), true);
  assert.equal(isValidTarget("drafts"), true);
  assert.equal(isValidTarget("gh-pages"), false);
  assert.equal(isValidTarget(""), false);
  assert.equal(isValidTarget(undefined), false);
});

test("saveDecision: файла ещё нет — сохраняем", () => {
  assert.equal(saveDecision({ target: "drafts", clientSha: null, currentSha: null }), "ok");
});

test("saveDecision: клиент не прислал базовый sha — сохраняем", () => {
  assert.equal(saveDecision({ target: "drafts", clientSha: null, currentSha: "D" }), "ok");
});

test("saveDecision: версия не менялась — сохраняем", () => {
  assert.equal(saveDecision({ target: "drafts", clientSha: "D", currentSha: "D" }), "ok");
  assert.equal(saveDecision({ target: "main", clientSha: "M", currentSha: "M" }), "ok");
});

// Регрессия: публикация молча затирала чужую правку
test("saveDecision: публикация поверх чужой правки — конфликт", () => {
  assert.equal(saveDecision({ target: "main", clientSha: "M0", currentSha: "M1" }), "conflict");
});

// Регрессия: черновик молча затирал чужой черновик
test("saveDecision: черновик поверх чужого черновика — конфликт", () => {
  assert.equal(
    saveDecision({ target: "drafts", clientSha: "D0", currentSha: "D1", mainSha: "M" }),
    "conflict"
  );
});

// Законный случай: правим опубликованное, ветка drafts отстала
test("saveDecision: черновик от опубликованного — сохраняем", () => {
  assert.equal(
    saveDecision({ target: "drafts", clientSha: "M", currentSha: "Dold", mainSha: "M" }),
    "ok"
  );
});

test("saveDecision: для drafts просит дочитать main, когда его ещё не читали", () => {
  assert.equal(
    saveDecision({ target: "drafts", clientSha: "D0", currentSha: "D1" }),
    "need-main-sha"
  );
});

test("saveDecision: файла нет на main — конфликт, а не повторный запрос", () => {
  assert.equal(
    saveDecision({ target: "drafts", clientSha: "M", currentSha: "Dold", mainSha: null }),
    "conflict"
  );
});
