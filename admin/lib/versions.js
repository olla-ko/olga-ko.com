"use strict";
// Лента версий страницы и правила удаления черновой версии.
// Чистые функции над данными GitHub API (см. admin/test/versions.test.js).

// Служебный коммит, которым админка подтягивает drafts после публикации.
// Дубликат уже показанной версии — в ленте не нужен.
const SYNC_PREFIX = "Sync draft after publish:";

// Что показывать в ленте версий:
//  1) историю файла на сайте (коммиты main, менявшие файл);
//  2) настоящие неопубликованные черновики — коммиты drafts, реально ушедшие
//     вперёд относительно main.
// Коммиты drafts, уже достижимые из main (например, затянутые туда мержем всей
// ветки), отдельной версией файла не являются и в ленту не попадают.
// truncated — ответ compare обрезан, список aheadShas неполон: тогда считаем
// черновиком всё, чего нет в истории файла на main, чтобы не скрыть настоящий.
function buildVersionList({ mainCommits, draftCommits, aheadShas, truncated }) {
  const inMain = new Set(mainCommits.map((c) => c.sha));
  const genuineDrafts = draftCommits.filter((c) =>
    truncated ? !inMain.has(c.sha) : aheadShas.has(c.sha)
  );
  const currentSha = mainCommits[0] ? mainCommits[0].sha : null; // это сейчас на сайте

  const seen = new Set();
  const versions = [];
  for (const c of [...mainCommits, ...genuineDrafts]) {
    if (seen.has(c.sha)) continue;
    seen.add(c.sha);
    const message = c.commit.message;
    if (message.startsWith(SYNC_PREFIX)) continue;
    versions.push({
      sha: c.sha,
      date:
        (c.commit.committer && c.commit.committer.date) ||
        (c.commit.author && c.commit.author.date) ||
        null,
      message,
      published: inMain.has(c.sha),
      isCurrent: c.sha === currentSha,
      viaAdmin: message.includes("(via admin)"),
    });
  }
  versions.sort((a, b) => new Date(b.date) - new Date(a.date));
  return versions;
}

// Схлопывание подряд идущих версий с одинаковым содержимым файла — типовой
// дубль «черновик + его публикация». Из пары остаётся опубликованная.
// blobShas — массив той же длины и порядка, что versions.
function dedupeVersions(versions, blobShas) {
  const out = [];
  for (const [i, source] of versions.entries()) {
    const v = { ...source, blobSha: blobShas[i] };
    const prev = out[out.length - 1];
    if (prev && prev.blobSha && v.blobSha && prev.blobSha === v.blobSha) {
      if (!prev.published && v.published) {
        v.published = true;
        v.isCurrent = prev.isCurrent || v.isCurrent;
        v.viaAdmin = prev.viaAdmin && v.viaAdmin;
        out[out.length - 1] = v;
      } else {
        prev.isCurrent = prev.isCurrent || v.isCurrent;
        prev.published = prev.published || v.published;
      }
      continue;
    }
    out.push(v);
  }
  return out;
}

// Можно ли удалить версию. Возвращает null (можно) либо { error }.
// Историю main не переписываем никогда: от неё зависят сайт и клоны репозитория.
function checkDeletable({ reachableFromMain, targetCommit, kept, commitFiles, path }) {
  if (reachableFromMain) {
    return { error: "Эта версия опубликована — удалять можно только черновики" };
  }
  if (!targetCommit.parents.length) {
    return { error: "Первый коммит репозитория удалить нельзя" };
  }
  // Линейная пересборка потеряла бы историю второй ветки мержа.
  if (targetCommit.parents.length > 1 || kept.some((c) => c.parents.length > 1)) {
    return { error: "В цепочке черновиков есть merge-коммит — удалить через админку нельзя" };
  }
  if ((commitFiles || []).some((f) => f.filename !== path)) {
    return { error: "Коммит затрагивает другие файлы — удалить через админку нельзя" };
  }
  return null;
}

// План пересборки ветки без удаляемого коммита, от старых коммитов к новым.
// Git хранит снапшоты: если коммит новее несёт то же содержимое файла, оно
// «всплывёт» после удаления — в таком коммите содержимое подменяется на
// предыдущее (а если файла до удаляемого коммита не было — удаляется).
// blobs: [удаляемое содержимое, содержимое до него, ...по одному на каждый kept].
function planVersionDeletion({ kept, blobs }) {
  const deletedBlob = blobs[0];
  const parentBlob = blobs[1];
  const steps = [];
  for (let i = kept.length - 1; i >= 0; i--) {
    const commit = kept[i];
    const carriesDeleted = Boolean(deletedBlob && blobs[2 + i] === deletedBlob);
    steps.push({
      commit,
      treeSha: commit.commit.tree.sha,
      overrideBlob: carriesDeleted ? parentBlob || null : null,
      removesFile: carriesDeleted && !parentBlob,
    });
  }
  return steps;
}

module.exports = { buildVersionList, dedupeVersions, checkDeletable, planVersionDeletion, SYNC_PREFIX };
