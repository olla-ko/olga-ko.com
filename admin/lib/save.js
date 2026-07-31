"use strict";
// Правила сохранения файла. Чистые функции: без сети, файлов и Express —
// поэтому проверяются тестами напрямую (см. admin/test/save.test.js).

const MAIN = "main";
const DRAFTS = "drafts";

// Писать можно только в main (публикация) или drafts (черновик).
function isValidTarget(target) {
  return target === MAIN || target === DRAFTS;
}

// Оптимистичная блокировка: не затираем чужую правку молча.
// mainSha: undefined — ещё не читали; null — читали, файла на main нет.
function saveDecision({ target, clientSha, currentSha, mainSha }) {
  // сверять не с чем: файла ещё нет либо клиент не прислал базовый sha
  if (!currentSha || !clientSha) return "ok";
  // на целевой ветке ничего не менялось с момента загрузки
  if (currentSha === clientSha) return "ok";
  // публикация: расхождение с main — всегда чужая правка
  if (target !== DRAFTS) return "conflict";
  // черновик: возможен законный случай «правим опубликованное, drafts отстал» —
  // для проверки нужен sha с main, оболочка дочитает его и спросит снова
  if (mainSha === undefined) return "need-main-sha";
  return mainSha === clientSha ? "ok" : "conflict";
}

module.exports = { isValidTarget, saveDecision, MAIN, DRAFTS };
