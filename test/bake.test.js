const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const bake = require("../lib/bake.js");

// bake.js превращает markdown в HTML на сборке сайта. Если он сломается,
// страницы молча поедут вёрсткой — поэтому проверяем структуру результата.
const fixture = (name) => path.join(__dirname, "fixtures", name);

// ---------- карточки портфолио ----------

test("портфолио: карточка собирается со всеми полями", () => {
  const html = bake.portfolioCards(fixture("portfolio.md"), false);
  assert.match(html, /class="card card-green"/, "цвет карточки из <<Цвет>>");
  assert.match(html, /<h2>Тестовый кейс<\/h2>/, "заголовок из ## ");
  assert.match(html, /src="\.\.\/img\/portfolio\/test\.png"/, "картинка");
  assert.match(html, /src="\.\.\/img\/portfolio\/test-mobile\.png"/, "мобильная картинка");
  assert.match(html, /Условная задача кейса\./);
  assert.match(html, /Условное решение кейса\./);
  assert.match(html, /class="button button-blue"/, "цвет кнопки из <<Цвет кнопки>>");
  assert.match(html, /Рассказ о решении/, "текст кнопки");
  assert.match(html, /href="test-case\/"/, "ссылка кнопки");
});

test("портфолио: заголовки блоков переводятся для английской версии", () => {
  const ru = bake.portfolioCards(fixture("portfolio.md"), false);
  const en = bake.portfolioCards(fixture("portfolio.md"), true);
  assert.match(ru, /<h4>Задача<\/h4>/);
  assert.match(ru, /<h4>Решение<\/h4>/);
  assert.match(en, /<h4>Task<\/h4>/);
  assert.match(en, /<h4>Solution<\/h4>/);
});

test("портфолио: пустой markdown не роняет сборку", () => {
  assert.doesNotThrow(() => bake.portfolioCardsFromString("", false));
});

// ---------- записи резюме ----------

test("резюме: запись собирается из тегов", () => {
  const html = bake.cvJobs(fixture("cv.md"));
  assert.match(html, /class="job"/);
  assert.match(html, /<h3>Product Designer<\/h3>/, "должность");
  assert.match(html, /Тестовая компания/);
  assert.match(html, /январь 2026/, "период");
  assert.match(html, /Чем занималась и какие результаты\./);
});

// ---------- markdown-страницы ----------

test("страница: заголовкам проставляются id для якорей", () => {
  const html = bake.singlePage(fixture("page.md"));
  assert.match(html, /<h1 id="Заголовок-страницы">/);
  assert.match(html, /<h2 id="Подзаголовок">/);
});

test("страница: каждая картинка обёрнута в контейнер", () => {
  const html = bake.singlePage(fixture("page.md"));
  const wrappers = html.match(/<div class="image">/g) || [];
  assert.equal(wrappers.length, 2, "обе картинки обёрнуты");
});

// Ручные размеры картинок: в исходных HTML-кейсах ретина-скриншоты ужимались
// вдвое скриптом. При переносе в markdown размеры задаются как ![](x.png =705).
test("страница: картинка с ручным размером получает ширину", () => {
  const html = bake.singlePage(fixture("page.md"));
  assert.match(html, /<img src="img\/narrow\.png"[^>]*width="705"/);
  assert.match(html, /style="width:705px;max-width:100%"/, "не вылезает за колонку");
});

test("страница: картинка без размера ширину не получает", () => {
  const html = bake.singlePage(fixture("page.md"));
  const wide = html.match(/<img[^>]*img\/wide\.png[^>]*>/)[0];
  assert.doesNotMatch(wide, /width=/);
});

test("страница: подпись картинки попадает в alt", () => {
  const html = bake.singlePage(fixture("page.md"));
  assert.match(html, /<img src="img\/narrow\.png" alt="подпись"/);
});

test("страница: размер указывается только цифрами", () => {
  // «=abc» — не размер, строка должна остаться обычной картинкой markdown
  const html = bake.singlePageFromString("![](x.png =abc)");
  assert.doesNotMatch(html, /width=/);
});
