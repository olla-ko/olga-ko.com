const { test, before } = require("node:test");
const assert = require("node:assert/strict");

// Инварианты собранного сайта. Рендерим шаблоны программно (toJSON): это только
// страницы, без копирования архива cat-in-cap — быстро и ничего не пишет на диск.
// Целые страницы с эталоном не сверяем: такие тесты ломались бы от любой правки
// вёрстки. Проверяем то, что должно быть верно всегда.

let pages; // Map<url, html>

before(async () => {
  const { default: Eleventy } = await import("@11ty/eleventy");
  const elev = new Eleventy(undefined, undefined, { configPath: "eleventy.config.js" });
  const json = await elev.toJSON();
  pages = new Map(json.map((p) => [p.url, p.content]));
});

const get = (url) => {
  const html = pages.get(url);
  assert.ok(html !== undefined, `страница ${url} не собралась`);
  return html;
};

test("собираются все ожидаемые разделы, и ни одна страница не пуста", () => {
  const expected = [
    "/",
    "/home.html",
    "/portfolio-ru/",
    "/portfolio-en/",
    "/big-library/",
    "/illustration/",
    "/calligraphy-and-lettering/",
    "/portfolio-ru/payments/",
    "/portfolio-en/payments/",
  ];
  for (const url of expected) {
    assert.ok(get(url).trim().length > 0, `страница ${url} пуста`);
  }
});

test("корень сайта перенаправляет на портфолио", () => {
  const html = get("/");
  assert.match(html, /http-equiv="refresh"[^>]*portfolio-ru\//, "перенаправление без JS");
  assert.match(html, /location\.replace\("portfolio-ru\/"\)/, "и через JS");
  assert.match(html, /rel="canonical"/, "канонический адрес для поисковиков");
});

test("разводная лежит на /home.html и ведёт во все разделы", () => {
  const html = get("/home.html");
  for (const href of ["portfolio-ru/", "big-library/", "illustration/", "calligraphy-and-lettering/", "cat-in-cap/"]) {
    assert.match(html, new RegExp(`href="${href.replace(/\//g, "\\/")}"`), `нет ссылки на ${href}`);
  }
});

test("лендинг портфолио содержит карточки кейсов", () => {
  const html = get("/portfolio-ru/");
  assert.match(html, /class="card card-/, "карточки запеклись на сборке");
  assert.match(html, /<h4>Задача<\/h4>/);
  const en = get("/portfolio-en/");
  assert.match(en, /<h4>Task<\/h4>/, "английский лендинг — с английскими заголовками");
});

test("markdown-страницы содержат ссылку возврата", () => {
  for (const url of ["/portfolio-ru/payments-md/", "/portfolio-en/payments-md/"]) {
    assert.match(get(url), /Вернуться к портфолио|Back to portfolio/, `нет возврата на ${url}`);
  }
});

test("страницы-кейсы отдают содержимое и картинки", () => {
  const html = get("/portfolio-ru/payments/");
  assert.match(html, /<img[^>]+src="[^"]*img\/portfolio\//, "скриншоты кейса на месте");
  assert.ok(html.length > 2000, "страница кейса не должна быть заглушкой");
});

test("у каждой страницы есть <title> и указан язык", () => {
  for (const [url, html] of pages) {
    assert.match(html, /<title>[^<]+<\/title>/, `нет заголовка окна: ${url}`);
    assert.match(html, /<html[^>]*\slang="(ru|en)"/, `не указан язык: ${url}`);
  }
});

test("в собранных страницах не осталось неразобранных тегов <<Тег>>", () => {
  for (const [url, html] of pages) {
    assert.doesNotMatch(html, /&lt;&lt;[^&]+&gt;&gt;|<<[А-Яа-я][^>]*>>/, `остался сырой тег: ${url}`);
  }
});
