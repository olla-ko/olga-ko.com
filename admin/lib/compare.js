"use strict";
// Чтение ответа GitHub «сравнить две ветки» (compareCommitsWithBasehead).
// Чистые функции над данными ответа — без сети (см. admin/test/compare.test.js).

// GitHub отдаёт максимум 250 коммитов и 300 файлов на сравнение.
const MAX_FILES = 300;

// Ответ обрезан по коммитам: их больше, чем нам отдали.
function isCommitsTruncated(compare) {
  return (compare.total_commits || 0) > (compare.commits || []).length;
}

// Ответ обрезан по файлам (или по коммитам — тогда и список файлов неполон).
function isFilesTruncated(compare) {
  return isCommitsTruncated(compare) || (compare.files || []).length >= MAX_FILES;
}

// Коммиты, реально ушедшие вперёд относительно базовой ветки.
function aheadShas(compare) {
  return new Set((compare.commits || []).map((c) => c.sha));
}

// Пути файлов, изменённых впереди базовой ветки.
function changedFilesAhead(compare) {
  return new Set((compare.files || []).map((f) => f.filename));
}

// Коммит уже достижим из main (то есть опубликован).
function isReachableFromMain(compare) {
  return compare.status === "identical" || compare.status === "behind";
}

module.exports = {
  isCommitsTruncated,
  isFilesTruncated,
  aheadShas,
  changedFilesAhead,
  isReachableFromMain,
};
