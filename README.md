# olga-ko.com

> **Не программист?** Начните с [РУКОВОДСТВО.md](РУКОВОДСТВО.md) — там по-человечески
> описано, что где лежит и как править/добавлять страницы без админки.

Персональный сайт-портфолио продуктового дизайнера Ольги Коноваловой.
Статический сайт (HTML/CSS/JS без сборки), задеплоен на GitHub Pages
(домен задаётся в [`CNAME`](CNAME)).

## Как запустить локально

Сайт собирается Eleventy (идёт поэтапный переезд — мигрированные страницы живут
шаблонами в [`src/`](src/), остальные копируются как есть, см.
[`eleventy.config.js`](eleventy.config.js)):

```bash
npm install
npm run build   # CSS + Eleventy → _site/
npm run serve   # dev-сервер с live-reload (http://localhost:8080)
```

Все страницы основного сайта — шаблоны Eleventy в `src/` (layout-ы кейсов, лендингов
и markdown-страниц — в `src/_includes/layouts/`); архив cat-in-cap копируется как есть.
Разводная (хаб) — [`src/pages/home.njk`](src/pages/home.njk), доступна по адресу
`/home.html`. Корень сайта `/` — клиентский редирект на `/portfolio-ru/`
([`src/pages/root-redirect.njk`](src/pages/root-redirect.njk)): GitHub Pages отдаёт
только статику, серверный 301 недоступен.

## Сборка стилей (Tailwind)

Весь проект использует Tailwind CSS v4. Собранные CSS **не коммитятся** — их собирает
CI при каждом деплое ([.github/workflows/pages.yml](.github/workflows/pages.yml)); там же
прогоняется проверка битых ссылок ([scripts/check_links.py](scripts/check_links.py)).
Для локальной разработки собрать один раз: `npm install && npm run build:css`. Два входа —
два выхода:

| Вход | Выход | Обслуживает |
|---|---|---|
| [`styles/tailwind.src.css`](styles/tailwind.src.css) | [`tailwind.css`](tailwind.css) | разводная, лендинги, кейсы, markdown-страницы |
| [`styles/cat-in-cap.src.css`](styles/cat-in-cap.src.css) | `cat-in-cap/blog/tailwind.css` | блог cat-in-cap |

```bash
npm install             # один раз
npm run build:css       # собрать оба CSS
npm run build:css:site  # только основной сайт
npm run build:css:blog  # только блог
npm run watch:css       # dev-режим (сайт); watch:css:blog — блог
```

Основной вход: `@theme` (Inter, фирменные цвета) + компонентные классы через `@apply`.
Стили лендингов скоуплены классом `.portfolio-page` на `<body>`, кейсов — `.case-page`,
markdown-страниц — `.md-page` (классы `.wrapper` и `.navigation` существуют в разных
типах страниц с разными стилями). Блог — utility-first в разметке (`index.html`,
`app.js`), палитра sky/slate, тёмная тема классом `.dark`; `cat-in-cap/style.css` —
слой поверх для того, что классами не выразить. При правке классов в разметке блога
не забывайте поднять кэш-бастер `?v=twN`. `node_modules/` и собранные CSS в `.gitignore`.

## Структура

Сайт двуязычный: `portfolio-ru/` (основной) и `portfolio-en/` — зеркальные версии.

| Тип страницы | Исходник | CSS | JS |
|---|---|---|---|
| Разводная (хаб), `/home.html` | `src/pages/home.njk` | `tailwind.css` (утилиты) | — |
| Редирект `/` → `/portfolio-ru/` | `src/pages/root-redirect.njk` | — | meta refresh + `location.replace` |
| Лендинги-хабы (портфолио + резюме) | `src/landing/*.njk` + `layouts/landing.njk` | `tailwind.css` (скоуп `.portfolio-page`) | `segment-control.js`, `avatar.js` |
| Страницы-кейсы (13 шт.) | `src/cases/*.njk` + `layouts/case.njk` | `tailwind.css` (скоуп `.case-page`) | `scriptCase.js` (ресайз картинок) |
| Markdown-страницы | `src/pages/*.njk` + `layouts/mdpage.njk` | `tailwind.css` (скоуп `.md-page`) | — |
| Старый сайт cat-in-cap.ru (архив) | `cat-in-cap/` — лендинг `index.html` + кейсы `*.htm` | архивные `style.css`, `inside-pages-style.css` (не Tailwind, как есть) | — |
| Блог (архив) | `cat-in-cap/blog/` | `blog/tailwind.css` (утилиты) + `blog/style.css` | `app.js` (hash-роутинг, поиск, темы) |

## Контент

Контент отделён от вёрстки и правится в Markdown; в HTML он запекается **на сборке**
([`lib/bake.js`](lib/bake.js) — шорткоды Eleventy, рендер тем же marked):

- Портфолио: [`portfolio-ru.md`](content/portfolio-ru.md), [`portfolio-en.md`](content/portfolio-en.md)
- Резюме: [`cv-ru.md`](content/cv-ru.md), [`cv-en.md`](content/cv-en.md)
- Markdown-страницы: `content.md` в соответствующей папке

Метаданные в md заданы кастомными тегами вида `<<Цвет>>`, `<<Картинка>>`,
`<<Задача>>`, `<<Решение>>`, `<<Период>>`, `<<Должность>>` и т.п.

## Админка (Railway)

[`admin/`](admin/) — веб-редактор контента (React + shadcn/ui + CodeMirror, split view
с живым предпросмотром). Это слой НАД репозиторием: каждое «Сохранить» — коммит
в ветку `drafts`, «Опубликовать» — коммит в `main` (деплоит обычный CI). У каждой
страницы в редакторе есть лента версий — git-история её файла в обеих ветках:
любую версию можно открыть, посмотреть в превью, отредактировать и опубликовать
(откат — это новый коммит, история не переписывается). Подряд идущие версии
с идентичным содержимым схлопываются в одну; кнопка «Сравнить» показывает
построчный дифф двух выбранных версий. Черновые версии можно удалять навсегда
(ветка `drafts` переписывается без этого коммита, содержимое вычищается из
истории файла); опубликованные — нельзя, история `main` неприкосновенна. **Сайт от админки не
зависит** — без Railway всё работает, правки возможны по-старому через git.

Превью рендерит тот же [`lib/bake.js`](lib/bake.js), что собирает прод, со стилями с
боевого сайта — что видишь в превью, то и будет опубликовано (панель превью всегда
светлая — это реальный вид сайта). У интерфейса есть светлая и тёмная тема
(переключатель в шапке сайдбара, выбор запоминается; по умолчанию — системная).

Деплой: Railway → репозиторий, конфиг в [`railway.json`](railway.json).
Env: `ADMIN_PASSWORD`, `GITHUB_TOKEN` (fine-grained: contents read/write + actions read
только для этого репо), `GITHUB_REPO`, `SESSION_SECRET`.
Локально: `cd admin && npm i && npm run build && ADMIN_PASSWORD=... node server.js`
(без `GITHUB_TOKEN` работает в локальном режиме — правит рабочее дерево напрямую).

## Соглашение по CSS

Единый подход: только Tailwind. Все стили основного сайта живут во входе
[`styles/tailwind.src.css`](styles/tailwind.src.css) (тема + компонентные классы,
скоупы `.portfolio-page` / `.case-page` / `.md-page`), стили блога — во входе
[`styles/cat-in-cap.src.css`](styles/cat-in-cap.src.css) + utility-классы в разметке.
Отдельных рукописных CSS-файлов, кроме `cat-in-cap/style.css` (слой поверх Tailwind),
в проекте нет.
