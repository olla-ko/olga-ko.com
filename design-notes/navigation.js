$('body').append('<footer><div class="gradient-divider" style="height: 2px;"></div><div class="footer-content"><a href="mailto:to.olga.konovalova@gmail.com">to.olga.konovalova@gmail.com</a></div></footer>');

if (!window.location.href.endsWith('research.html') && !window.location.href.endsWith('index.html')) {
    $('.text').append('<div class="next-article"><a href=""><span>Перейти к следующей заметке</span><svg xmlns="http://www.w3.org/2000/svg" width="17" height="16" viewBox="0 0 17 16" fill="none"><path opacity="0.8" fill-rule="evenodd" clip-rule="evenodd" d="M10.5757 0.798304L16.7005 7.27983C17.0998 7.67757 17.0998 8.32243 16.7005 8.72017L10.5757 15.2017C10.1764 15.5994 9.52897 15.5994 9.12966 15.2017C8.73036 14.804 8.73036 14.1591 9.12966 13.7614L13.8912 9.01847H1.01847C0.455986 9.01847 0 8.56249 0 8C0 7.43751 0.455987 6.98153 1.01847 6.98153H13.8912L9.12966 2.23864C8.73036 1.8409 8.73036 1.19604 9.12966 0.798304C9.52897 0.400565 10.1764 0.400565 10.5757 0.798304Z" fill="#1890FF"/></svg></a></div>');
}
if (window.location.href.endsWith('index.html')) {
    $('.text').append('<div class="next-article"><a href=""><span>Перейти к первой заметке</span><svg xmlns="http://www.w3.org/2000/svg" width="17" height="16" viewBox="0 0 17 16" fill="none"><path opacity="0.8" fill-rule="evenodd" clip-rule="evenodd" d="M10.5757 0.798304L16.7005 7.27983C17.0998 7.67757 17.0998 8.32243 16.7005 8.72017L10.5757 15.2017C10.1764 15.5994 9.52897 15.5994 9.12966 15.2017C8.73036 14.804 8.73036 14.1591 9.12966 13.7614L13.8912 9.01847H1.01847C0.455986 9.01847 0 8.56249 0 8C0 7.43751 0.455987 6.98153 1.01847 6.98153H13.8912L9.12966 2.23864C8.73036 1.8409 8.73036 1.19604 9.12966 0.798304C9.52897 0.400565 10.1764 0.400565 10.5757 0.798304Z" fill="#1890FF"/></svg></a></div>');
}

$('.main').prepend('<div class="navigation"></div>');

$('.navigation').append('<ul> <li><a href="index.html">Вступление</a></li> <li><a href="new-designer.html">1. Начинающему проектировщику</a></li> <li><a href="talk.html">2. Общайся</a></li> <li><a href="present.html">3. Презентуй свои решения</a></li> <li><a href="redesign.html">4. Хочу все переделать</a></li> <li><a href="too-hard.html">5. Мне достался сложный проект</a></li> <li><a href="be-confident.html">6. Борем неуверенность</a></li> <li><a href="beauty-vs-usability.html">7. Красота vs&nbsp;удобство</a></li> <li><a href="they-will-learn.html">8. Заблуждение: они&nbsp;обучатся</a></li><li><a href="we-will-test.html">9. Заблуждение: мы&nbsp;потестим</a></li> <li><a href="they-will-adjust.html">10. Заблуждение: они&nbsp;настроят</a></li> <li><a href="research.html">11. Измеряй</a></li></ul>');

var header = $('h1').text();
$('a:contains('+ header +')').parent('li').addClass('active');

var next_article = $('li.active').next('li').find('a').attr('href');
$('div.next-article').find('a').attr('href', next_article);

$(document).ready(function(){
    $(".burger").click(function(){
        $(".navigation").toggle();
    });
});

window.addEventListener('resize', function(event) {
    if (window.innerWidth > 1300) {
        $(".navigation").show();
    }
}, true);