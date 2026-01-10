function getCurrentURL() {
    return window.location.href;
}

document.querySelector("#segment-rus").addEventListener("click", function() {
    let currentURL = getCurrentURL();
    if (currentURL.includes("#cv")) {
        window.open("https://olga-ko.com/portfolio-ru/index.html#cv","_self");
    }
    if (currentURL.includes("#portfolio")) {
        window.open("https://olga-ko.com/portfolio-ru/index.html#portfolio","_self");
    }
    else {
        window.open("https://olga-ko.com/portfolio-ru/index.html","_self");
    };
});

document.querySelector("#segment-eng").addEventListener("click", function() {
    let currentURL = getCurrentURL();
    if (currentURL.includes("#cv")) {
        window.open("https://olga-ko.com/portfolio-en/index.html#cv","_self");
    }
    if (currentURL.includes("#portfolio")) {
        window.open("https://olga-ko.com/portfolio-en/index.html#portfolio","_self");
    }
    else {
        window.open("https://olga-ko.com/portfolio-en/index.html","_self");
    };
});

document.querySelector("#segment-cv").addEventListener("click", function() {
    window.location.hash = "cv";
    //Включаю анимацию для белого таба
    document.querySelector("#NavSelectedSegment").classList.add("segment-transition");
    //Меняю положение белого таба
    document.querySelector("#NavSelectedSegment").classList.remove("selected-segment-first");
    document.querySelector("#NavSelectedSegment").classList.add("selected-segment-second");
    //Добавлю класс "selected" к табу Резюме
    document.querySelector("#segment-cv").classList.add("selected");
    //Убираю класс "selected" с таба  Портфолио
    document.querySelector("#segment-portfolio").classList.remove("selected");
    //Скрываю контент Резюме и показываю контент Портфолио
    document.querySelector(".portfolio").classList.remove("fadeIn");
    document.querySelector(".portfolio").classList.add("hide-to-left");
    document.querySelector(".cv").classList.remove("hide-to-left");
    document.querySelector(".cv").classList.add("fadeIn");
    setTimeout(function() {
        document.querySelector(".portfolio").style.display = "none";
        document.querySelector(".cv").style.display = "flex";
    }, 100);
    //Показываю скачивание PDF
    document.querySelector("#pdf").style.opacity = "0";
    document.querySelector("#pdf").style.scale = "0";
    document.querySelector("#pdf").style.minWidth = "50px";
    document.querySelector("#pdf span").style.opacity = "0";
    document.querySelector("#pdf").classList.remove("hide-pdf-animation");
    document.querySelector("#pdf").classList.add("show-pdf-animation");
    document.querySelector("#pdf span").classList.add("show-pdf-span-animation");
    document.querySelector("#pdf").style.opacity = "1";
});

document.querySelector("#segment-portfolio").addEventListener("click", function() {
    window.location.hash = "portfolio";
    //Включаю анимацию для белого таба
    document.querySelector("#NavSelectedSegment").classList.add("segment-transition");
    //Меняю положение белого таба
    document.querySelector("#NavSelectedSegment").classList.remove("selected-segment-second");
    document.querySelector("#NavSelectedSegment").classList.add("selected-segment-first");
    //Убираю класс "selected" с таба  Резюме
    document.querySelector("#segment-cv").classList.remove("selected");
    //Добавляю класс "selected" к табу Портфолио
    document.querySelector("#segment-portfolio").classList.add("selected");
    //Скрываю контент Портфолио и показываю контент Резюме
    document.querySelector(".cv").classList.remove("fadeIn");
    document.querySelector(".cv").classList.add("hide-to-right");
    document.querySelector(".portfolio").classList.remove("hide-to-left");
    document.querySelector(".portfolio").classList.add("fadeIn");
    setTimeout(function() {
        document.querySelector(".cv").style.display = "none";
        document.querySelector(".portfolio").style.display = "flex";
    }, 100);
    //Скрываю скачивание PDF
    document.querySelector("#pdf").style.opacity = "1";
    document.querySelector("#pdf").style.scale = "1";
    document.querySelector("#pdf").style.minWidth = "100px";
    document.querySelector("#pdf").classList.add("hide-pdf-animation");
    setTimeout(function() {
        document.querySelector("#pdf").classList.remove("show-pdf-animation");
        document.querySelector("#pdf span").classList.remove("show-pdf-span-animation");
    }, 100);
});


document.addEventListener("DOMContentLoaded", function() {
    let currentURL = getCurrentURL();
    document.querySelector("#cv").style.display = "none";
    document.querySelector("#portfolio").style.display = "none";
    if (currentURL.includes("#cv")) {
        document.querySelector("#cv").style.display = "none";
        document.querySelector("#portfolio").style.display = "none";
        document.querySelector("#NavSelectedSegment").classList.add("selected-segment-second");
        document.querySelector("#NavSelectedSegment").classList.remove("selected-segment-first");
        document.querySelector("#segment-cv").classList.add("selected");
        document.querySelector("#segment-portfolio").classList.remove("selected");
        setTimeout(function() {
            document.querySelector("#cv").style.display = "flex";
            document.querySelector("#portfolio").style.display = "none";
        }, 100);
        // //Показываю скачивание PDF
        document.querySelector("#pdf").style.opacity = "1";
        document.querySelector("#pdf").style.scale = "1";
            document.querySelector("#pdf").style.minWidth = "100px";
            document.querySelector("#pdf span").style.opacity = "1";
    }
    else {
        document.querySelector("#cv").style.display = "none";
        document.querySelector("#portfolio").style.display = "none";
        document.querySelector("#NavSelectedSegment").classList.add("selected-segment-first");
        document.querySelector("#NavSelectedSegment").classList.remove("selected-segment-second");
        document.querySelector("#segment-cv").classList.remove("selected");
        document.querySelector("#segment-portfolio").classList.add("selected");
        setTimeout(function() {
            document.querySelector("#cv").style.display = "none";
            document.querySelector("#portfolio").style.display = "flex";
        }, 100);
    }
});