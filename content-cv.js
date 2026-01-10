document.addEventListener("DOMContentLoaded", async () => {
  try {
    const filePath = window.location.href.includes("portfolio-en")
      ? '../cv-en.md'
      : '../cv-ru.md';

    // Загружаем файл
    const response = await fetch(filePath);
    if (!response.ok) throw new Error("Не удалось загрузить файл CV");

    const markdownContent = await response.text();
    const jobBlocks = markdownContent.split('---'); // Разделяем блоки проектов

    const htmlContent = jobBlocks.map(block => {
        // Парсим содержимое блока
        const periodMatch = block.match(/<<Период>>\n([\s\S]*?)(?=\n<<|$)/);
        const positionMatch = block.match(/<<Должность>>\n([\s\S]*?)(?=\n<<|$)/);
        const companyMatch = block.match(/<<Компания>>\n([\s\S]*?)(?=\n<<|$)/);
        const descriptionMatch = block.match(/<<Описание>>\n([\s\S]*?)(?=\n<<|$)/);
      
        // Извлекаем текст и обрабатываем с помощью marked.parse для Markdown
        const period = periodMatch ? periodMatch[1].trim() : '';
        const position = positionMatch ? positionMatch[1].trim() : '';
        const company = companyMatch ? marked.parse(companyMatch[1].trim()) : '';
        const description = descriptionMatch ? marked.parse(descriptionMatch[1].trim()) : '';
      
        // Создаем HTML структуру для работы
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
      }).join('');

    document.getElementById("cv").innerHTML = htmlContent;
  } catch (error) {
    console.error("Ошибка при загрузке CV:", error);
  }
});