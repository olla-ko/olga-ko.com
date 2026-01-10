document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Определяем язык и файл
    let isEnglish = window.location.href.includes("portfolio-en");
    let filePath = isEnglish ? '../../portfolio-en.md' : '../../portfolio-ru.md';

    let response = await fetch(filePath);
    if (!response.ok) {
      // Если не удалось загрузить файл по первому пути, пробуем альтернативный путь
      filePath = isEnglish ? '../portfolio-en.md' : '../portfolio-ru.md';
      response = await fetch(filePath);
      if (!response.ok) throw new Error("Не удалось загрузить файл портфолио");
    }

    let markdownContent = await response.text();
    let projectBlocks = markdownContent.split('---'); // Разделяем блоки проектов

    let htmlContent = projectBlocks.map(block => {
      let titleMatch = block.match(/##\s*(.*)/);
      let colorMatch = block.match(/<<Цвет>>\n([\s\S]*?)(?=\n<<|$)/);
      let imageMatch = block.match(/<<Картинка>>\n([\s\S]*?)(?=\n<<|$)/);
      let mobileImageMatch = block.match(/<<Картинка мобильная>>\n([\s\S]*?)(?=\n<<|$)/);
      let taskMatch = block.match(/<<Задача>>\n([\s\S]*?)(?=\n<<|$)/);
      let solutionMatch = block.match(/<<Решение>>\n([\s\S]*?)(?=\n<<|$)/);
      let buttonColorMatch = block.match(/<<Цвет кнопки>>\n([\s\S]*?)(?=\n<<|$)/);
      let buttonTextMatch = block.match(/<<Текст кнопки>>\n([\s\S]*?)(?=\n<<|$)/);
      let linkMatch = block.match(/<<Ссылка кнопки>>\n([\s\S]*?)(?=\n<<|$)/);

      let title = titleMatch ? titleMatch[1].trim() : '';
      let color = colorMatch ? colorMatch[1].trim() : 'green'; // По умолчанию — green
      let image = imageMatch ? imageMatch[1].trim() : '';
      let mobileImage = mobileImageMatch ? mobileImageMatch[1].trim() : '';
      let task = taskMatch ? taskMatch[1].trim() : '';
      let solution = solutionMatch ? marked.parse(solutionMatch[1].trim()) : '';
      let buttonColor = buttonColorMatch ? buttonColorMatch[1].trim() : 'button-green'; // По умолчанию — button-green
      let buttonText = buttonTextMatch ? buttonTextMatch[1].trim() : 'Подробнее'; // По умолчанию — "Подробнее"
      let link = linkMatch ? linkMatch[1].trim() : '';

      // Меняем заголовки на основе языка
      let taskHeading = isEnglish ? "Task" : "Задача";
      let solutionHeading = isEnglish ? "Solution" : "Решение";

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
    }).join('');

    document.getElementById("portfolio").innerHTML = htmlContent;
  } catch (error) {
    console.error("Ошибка при загрузке портфолио:", error);
  }
});