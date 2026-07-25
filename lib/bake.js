// Build-time рендеринг контента из md — точный порт бывших runtime-скриптов
// content-portfolio.js, content-cv.js, content-single-page.js (та же логика,
// тот же marked). Рутина правки md не меняется: те же файлы, те же <<Теги>>.
const fs = require("fs");
const { marked } = require("marked");

// === бывший content-portfolio.js ===
function portfolioCardsFromString(markdownContent, isEnglish) {
  const projectBlocks = markdownContent.split("---");

  return projectBlocks
    .map((block) => {
      const titleMatch = block.match(/##\s*(.*)/);
      const colorMatch = block.match(/<<Цвет>>\n([\s\S]*?)(?=\n<<|$)/);
      const imageMatch = block.match(/<<Картинка>>\n([\s\S]*?)(?=\n<<|$)/);
      const mobileImageMatch = block.match(/<<Картинка мобильная>>\n([\s\S]*?)(?=\n<<|$)/);
      const taskMatch = block.match(/<<Задача>>\n([\s\S]*?)(?=\n<<|$)/);
      const solutionMatch = block.match(/<<Решение>>\n([\s\S]*?)(?=\n<<|$)/);
      const buttonColorMatch = block.match(/<<Цвет кнопки>>\n([\s\S]*?)(?=\n<<|$)/);
      const buttonTextMatch = block.match(/<<Текст кнопки>>\n([\s\S]*?)(?=\n<<|$)/);
      const linkMatch = block.match(/<<Ссылка кнопки>>\n([\s\S]*?)(?=\n<<|$)/);

      const title = titleMatch ? titleMatch[1].trim() : "";
      const color = colorMatch ? colorMatch[1].trim() : "green";
      const image = imageMatch ? imageMatch[1].trim() : "";
      const mobileImage = mobileImageMatch ? mobileImageMatch[1].trim() : "";
      const task = taskMatch ? taskMatch[1].trim() : "";
      const solution = solutionMatch ? marked.parse(solutionMatch[1].trim()) : "";
      const buttonColor = buttonColorMatch ? buttonColorMatch[1].trim() : "button-green";
      const buttonText = buttonTextMatch ? buttonTextMatch[1].trim() : "Подробнее";
      const link = linkMatch ? linkMatch[1].trim() : "";

      const taskHeading = isEnglish ? "Task" : "Задача";
      const solutionHeading = isEnglish ? "Solution" : "Решение";

      return `
        <div class="card card-${color}">
          <a href="${link}">
            <div class="thumbnail">
              <img src="${image}">
            </div>
            <div class="thumbnail-mobile">
              <img src="${mobileImage}">
            </div>
          </a>
            <div class="description">
            <h2>${title}</h2>
            <div class="description-table">
              <div class="row">
                <div class="cell header">
                  <h4>${taskHeading}</h4>
                </div>
                <div class="cell content">
                  <p>${task}</p>
                </div>
              </div>
              <div class="row">
                <div class="cell header">
                  <h4>${solutionHeading}</h4>
                </div>
                <div class="cell content">
                  ${solution}
                </div>
              </div>
            </div>
            <a href="${link}">
              <div class="button button-${buttonColor}">
                ${buttonText}
              </div>
            </a>
          </div>
        </div>
      `;
    })
    .join("");
}

// === бывший content-cv.js ===
function cvJobsFromString(markdownContent) {
  const jobBlocks = markdownContent.split("---");

  return jobBlocks
    .map((block) => {
      const periodMatch = block.match(/<<Период>>\n([\s\S]*?)(?=\n<<|$)/);
      const positionMatch = block.match(/<<Должность>>\n([\s\S]*?)(?=\n<<|$)/);
      const companyMatch = block.match(/<<Компания>>\n([\s\S]*?)(?=\n<<|$)/);
      const descriptionMatch = block.match(/<<Описание>>\n([\s\S]*?)(?=\n<<|$)/);

      const period = periodMatch ? periodMatch[1].trim() : "";
      const position = positionMatch ? positionMatch[1].trim() : "";
      const company = companyMatch ? marked.parse(companyMatch[1].trim()) : "";
      const description = descriptionMatch ? marked.parse(descriptionMatch[1].trim()) : "";

      return `
          <div class="job">
            <div class="period secondary-text">${period}</div>
            <div class="job-description">
              <div>
                <h3>${position}</h3>
                ${company}
                <div class="period-mobile">${period}</div>
              </div>
              <div>
                ${description}
              </div>
            </div>
          </div>
        `;
    })
    .join("");
}

// === бывший content-single-page.js ===
function singlePageFromString(markdown) {
  // ручной размер картинки: ![подпись](путь =600) → ширина 600px, высота по пропорции
  // (инлайновый width перебивает w-full из .md-page .image img; max-width — чтобы
  // не вылезать за колонку на узких экранах)
  markdown = markdown.replace(
    /!\[([^\]]*)\]\(([^()\s]+)\s+=(\d+)\)/g,
    (m, alt, src, w) => `<img src="${src}" alt="${alt}" width="${w}" style="width:${w}px;max-width:100%">`
  );

  let htmlContent = marked.parse(markdown);

  // processImages: каждая картинка оборачивается в <div class="image">
  htmlContent = htmlContent.replace(/<img\b[^>]*>/g, (img) => `<div class="image">${img}</div>`);

  // assignHeadingIds: id из текста заголовка (та же схема слагов)
  let index = 0;
  htmlContent = htmlContent.replace(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, inner) => {
    let text = inner.replace(/<[^>]*>/g, "").trim();
    if (!text) text = `heading-${index}`;
    let id = text
      .replace(/\s+/g, "-")
      .replace(/[^а-яёa-z0-9\-]/gi, "")
      .replace(/^-+|-+$/g, "");
    id = id || `heading-${index}`;
    index++;
    return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
  });

  return `<div>${htmlContent}</div>`;
}

// fs-обёртки — прежнее API для шорткодов Eleventy
function portfolioCards(mdPath, isEnglish) {
  return portfolioCardsFromString(fs.readFileSync(mdPath, "utf-8"), isEnglish);
}
function cvJobs(mdPath) {
  return cvJobsFromString(fs.readFileSync(mdPath, "utf-8"));
}
function singlePage(mdPath) {
  return singlePageFromString(fs.readFileSync(mdPath, "utf-8"));
}

module.exports = {
  portfolioCards, cvJobs, singlePage,
  portfolioCardsFromString, cvJobsFromString, singlePageFromString,
};
