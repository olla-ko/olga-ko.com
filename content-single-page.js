// Функция для загрузки и обработки содержимого .md файла
async function loadMarkdown() {
    let mdFilePath = 'content.md'; // Определяем путь к .md файлу
    try {
        let response = await fetch(mdFilePath);
        if (!response.ok) throw new Error('Ошибка загрузки файла');

        let markdown = await response.text();

        // Конвертация Markdown в HTML
        let htmlContent = marked.parse(markdown);

        // Обработка изображений
        htmlContent = processImages(htmlContent);

        // Создание временного контейнера для работы с HTML
        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        // Присвоение ID заголовкам
        assignHeadingIds(tempDiv);

        // Получаем целевой контейнер
        const contentContainer = document.getElementById('content');
        if (!contentContainer) {
            throw new Error('Контейнер с ID "content" не найден');
        }

        // Добавляем обработанный контент в целевой контейнер
        contentContainer.appendChild(tempDiv);

    } catch (error) {
        console.error('Ошибка:', error);
        const errorDiv = document.createElement('div');
        errorDiv.textContent = `Не удалось загрузить файл: ${error.message}`;
        document.getElementById('content')?.appendChild(errorDiv);
    }
}

// Функция для обработки изображений
function processImages(content) {
    let container = document.createElement('div');
    container.innerHTML = content;

    let images = Array.from(container.querySelectorAll('img')); // Массив всех изображений

    images.forEach((img) => {
        let rowDiv = document.createElement('div');
        rowDiv.className = 'image';

        let parent = img.parentNode;
        parent.insertBefore(rowDiv, img); // Вставляем обертку перед изображением
        rowDiv.appendChild(img); // Перемещаем изображение внутрь обертки
    });

    return container.innerHTML;
}

// Функция для присвоения ID заголовкам
function assignHeadingIds(container) {
    let headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')); // Все заголовки h*

    headings.forEach((heading, index) => {
        let text = heading.textContent.trim(); // Получаем текст заголовка
        if (!text) {
            // Если текст пустой, используем порядковый индекс для ID
            text = `heading-${index}`;
        }

        // Преобразуем текст в id
        let id = text
            .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
            .replace(/[^а-яёa-z0-9\-]/gi, '') // Удаляем все символы, кроме букв (латиница, кириллица), цифр и дефисов
            .replace(/^-+|-+$/g, ''); // Убираем дефисы в начале и конце строки

        heading.id = id || `heading-${index}`; // Если id всё ещё пустой, присваиваем уникальный индекс
    });
}

// Вызов функции загрузки
loadMarkdown();