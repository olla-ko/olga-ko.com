function resizeImage(img, referenceWidth) {
    if (img.complete) {
      resizeBasedOnReferenceWidth(img, referenceWidth);
    } else {
      img.onload = function() {
        resizeBasedOnReferenceWidth(img, referenceWidth);
      };
    }
  }
  
function resizeBasedOnReferenceWidth(img, referenceWidth) {
    var originalWidth = img.naturalWidth;
    var originalHeight = img.naturalHeight;
    
    if (originalWidth > referenceWidth) {
      img.style.width = '100%';
      img.style.height = 'auto';
    } else {
      var halfWidth = originalWidth / 2;
      var halfHeight = originalHeight / 2;
  
      img.style.width = halfWidth + 'px';
      img.style.height = halfHeight + 'px';
    }
  }
  
// Получаем ширину второго элемента с классом 'td', если он существует
var tdElements = document.querySelectorAll('.td');
var referenceWidth = tdElements.length > 1 ? tdElements[1].clientWidth : 0;

if (referenceWidth === 0) {
  console.error('Не найден второй элемент с классом "td".');
  // Можно добавить здесь дополнительную логику обработки отсутствия второго элемента 'td'
} else {
  var images = document.querySelectorAll('img.doubleSize');
  images.forEach(function(img) {
    resizeImage(img, referenceWidth);
  });
}