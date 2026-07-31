function updateAvatarSize() {
    const header = document.querySelector('.hello > span > h3');
    const location = document.querySelector('.hello > span > span');
    const avatarImage = document.querySelector('.hello img');

    // Получаем высоту h3 и span внутри textContainer
    const height = header.offsetHeight + location.offsetHeight + 2;
    // console.log(height);

    // Присваиваем эту высоту как высоту и ширину изображения
    avatarImage.style.height = `${height}px`;
    avatarImage.style.width = `${height}px`;
}

// Запускаем функцию при загрузке страницы
window.addEventListener('load', updateAvatarSize);

// Запускаем функцию при изменении размеров окна
window.addEventListener('resize', updateAvatarSize);