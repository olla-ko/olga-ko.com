# Миграция лендинга портфолио на Tailwind (пилот) — дизайн

Дата: 2026-07-01

## Контекст и цель

После внедрения Tailwind (prebuilt) на разводной странице — переносим на Tailwind стили
портфолио, начиная с лендинга-хаба. Основа — существующие стили портфолио («система B»:
`reset.css`, `colors-portfolio.css`, `typography-portfolio.css`, `style-portfolio.css`,
`animation.css`). Цель — выразить их средствами Tailwind, оставаясь визуально близко к
текущему виду.

## Решения (согласовано)

- **Способ:** вариант **A** — компонентные классы через `@apply`. Семантические классы
  (`.card`, `.button`, `.segment-control` …) сохраняем, переопределяем через `@apply` +
  токены темы. HTML и JS не трогаем — динамические классы (`.card-${color}`,
  `.button-${buttonColor}`) продолжают работать.
- **Точность:** идиоматичный Tailwind — значения снапим к шкале Tailwind ради чистых
  классов. Где снап даёт **заметный** сдвиг — оставляем точное значение (arbitrary).
  Допустимы микро-сдвиги, грубых изменений нет.
- **Порядок:** сначала лендинг (`portfolio-ru` + `portfolio-en`), затем 13 кейсов —
  отдельной задачей.

## Область

- Меняем: `portfolio-ru/index.html`, `portfolio-en/index.html` (только `<link>`-и на стили),
  `styles/tailwind.src.css` (тема + компонентный слой), пересобранный `tailwind.css`.
- Не трогаем: `content-portfolio.js`, `content-cv.js`, `segment-control.js`, `avatar.js`,
  разметку лендингов, страницы-кейсы (система A остаётся на своих CSS).

## Реализация

1. **Тема** (`@theme` в `tailwind.src.css`): палитра из `colors-portfolio.css` →
   `--color-*` (primary/green/red/blue + hover/active, тинты карточек `card-green/yellow/blue`,
   `accent-tint`). Inter уже подключён.
2. **Компонентный слой** (`@layer components` в `tailwind.src.css`): перенос правил из
   `typography-portfolio.css` и `style-portfolio.css` через `@apply`. Селекторы: `.wrapper`,
   `.card`, `.card-border`, `.card-{green,yellow,blue}`, `.about`, `.hello`, `.links`,
   `.button` (+ `.button-{green,red,blue}`), `.segment-control`, `.selected-segment`(+first/second/transition),
   `.language`, `.navigation`, `.pdf`, `.description`, `.description-table`, `.row`, `.cell`,
   `.thumbnail`(+mobile), `.period`(+mobile), `.job`, типографика (`h1–h4`, `a`, `ul/li`,
   `.secondary-text`), адаптив (`@media` → варианты `max-*`/по брейкпоинтам).
3. **Preflight вместо `reset.css`**: явно вернуть то, что нужно портфолио и что Preflight
   убирает — маркеры списков в блоке «В своей работе», стили заголовков.
4. **Анимации**: `fadeIn`, `hide-to-left/right`, `show-pdf(+span)`, `hide-pdf` из
   `animation.css` → `@keyframes` в Tailwind-входе + классы/утилиты.
5. **Подключение**: в обоих `index.html` заменить 5 `<link>` (reset/colors/typography/style/
   animation) на один `<link href="../tailwind.css">`. Добавить оба лендинга в `@source`.
   Пересобрать `tailwind.css` (станет общим для разводной + лендинга).

## Проверка (end-to-end)

1. `npm run build:css` без ошибок; `tailwind.css` содержит нужные классы.
2. Локальный сервер, скриншоты `portfolio-ru/` и `portfolio-en/` (вкладки «Портфолио» и
   «Резюме») — сверка до/после. Микро-сдвиги допустимы, грубых изменений нет.
3. Работают: переключение portfolio/cv, переключение языка, аватар (`avatar.js`),
   PDF-кнопка (анимация), генерация карточек (`content-portfolio.js`) и CV (`content-cv.js`).
4. Резолв всех ассетов, консоль без ошибок (кроме внешней Метрики в песочнице).
5. Кейсы (система A) визуально не затронуты.

## Вне объёма

- Миграция 13 страниц-кейсов (система A) — следующая задача.
- Любой редизайн — переносим текущий вид, не улучшаем.
