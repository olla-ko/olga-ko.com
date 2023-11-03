function resizeImage(img) {
    // Убедитесь, что изображение полностью загружено
    if (img.complete) {
      resizeBasedOnWidth(img);
    } else {
      // Если изображение не загружено, подождите, пока оно загрузится
      img.onload = function() {
        resizeBasedOnWidth(img);
      };
    }
  }
  
  function resizeBasedOnWidth(img) {
    // Получаем исходные размеры изображения
    var originalWidth = img.naturalWidth;
    var originalHeight = img.naturalHeight;
    
    // Проверяем, больше ли ширина изображения 2000px
    if (originalWidth > 2000) {
      // Устанавливаем ширину изображения в 1000px
      // Высота изменится автоматически, чтобы сохранить пропорции
      img.style.width = '1000px';
      img.style.height = 'auto';
    } else {
      // Вычисляем новые размеры
      var halfWidth = originalWidth / 2;
      var halfHeight = originalHeight / 2;
  
      // Применяем новые размеры к изображению
      img.style.width = halfWidth + 'px';
      img.style.height = halfHeight + 'px';
    }
  }
  
  // Получаем все изображения с классом '2X'
  var images = document.querySelectorAll('img.doubleSize');
  
  // Применяем функцию resizeImage к каждому изображению
  images.forEach(resizeImage);