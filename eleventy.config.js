// Конфиг Eleventy. Вход — src/ (шаблоны и контент мигрированных страниц),
// выход — _site/ (то, что уезжает на GitHub Pages).
//
// Миграция поэтапная: всё, что ещё НЕ мигрировано, копируется в _site/ как есть
// (passthrough ниже). Когда страница мигрирует, её статичный HTML удаляется из
// дерева, а шаблон появляется в src/ — конфликтов «копия против генерации» нет.
const bake = require("./lib/bake.js");

module.exports = function (eleventyConfig) {
  // build-time рендеринг контента (бывшие runtime-скрипты)
  eleventyConfig.addShortcode("portfolioCards", (lang) =>
    bake.portfolioCards(`content/portfolio-${lang}.md`, lang === "en"));
  eleventyConfig.addShortcode("cvJobs", (lang) =>
    bake.cvJobs(`content/cv-${lang}.md`));
  eleventyConfig.addShortcode("singlePage", (mdSource) =>
    bake.singlePage(mdSource));

  // --- немигрированная статика (пути от корня репозитория) ---
  const passthrough = [
    "tailwind.css",          // собирается перед eleventy (npm run build:css)
    "assets",
    "img",
    "portfolio-ru",
    "portfolio-en",
    "portfolio",
    "cv-en",
    "cv-ru",
    "illustration",
    "big-library",
    "calligraphy-and-lettering",
    "cat-in-cap",            // архив старого сайта + блог (не мигрируем никогда)
    "CNAME",
    // корневые JS, которые подключают страницы
    "avatar.js",
    "segment-control.js",
    "scriptCase.js",
  ];
  for (const p of passthrough) {
    eleventyConfig.addPassthroughCopy({ [p]: p });
  }

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
