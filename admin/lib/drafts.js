"use strict";
// Признак «у файла есть неопубликованный черновик».
// Чистая функция над деревьями файлов (см. admin/test/drafts.test.js).

// Черновик есть, когда содержимое на drafts отличается от main И это отличие
// возникло из-за правки, реально ушедшей вперёд в drafts. Одной разницы мало:
// если файл правили напрямую в main, ветка drafts просто отстаёт — это не
// черновик, и бейдж «не опубликовано» гореть не должен.
//
// mainTree / draftTree — Map<путь, sha содержимого>.
// truncated — ответ compare обрезан, список изменённых файлов неполон; тогда
// падаем на простое сравнение содержимого: лучше лишний бейдж, чем скрытый
// от пользователя черновик.
function computeHasDraft({ paths, mainTree, draftTree, changedAheadInDrafts, truncated }) {
  const result = new Map();
  for (const path of paths) {
    const inMain = mainTree.get(path);
    const inDrafts = draftTree.get(path);
    const differs = Boolean(inMain && inDrafts && inMain !== inDrafts);
    const changedAhead = truncated || changedAheadInDrafts.has(path);
    result.set(path, differs && changedAhead);
  }
  return result;
}

module.exports = { computeHasDraft };
