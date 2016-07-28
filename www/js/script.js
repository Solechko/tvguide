$(document).ready(function() { 
    var isMouseOverPopup = false;   
    var showPopupDelayTimer = 0;   
    var hidePopupDelayTimer = 0; 
    var filters = [];  
    var xmlTv;
    var channels;
       
    // Получение xmltv файла, заполнение списка каналов, текущего эфира, программы на сегодня, инициализация событий
    $.ajax({
        type: "GET",
        url: 'currentxmltv.xml',
        dataType: "xml",
        success: function(result) {        
            xmlTv = new xmlTvParser(result);
            channels = xmlTv.getChannelsSchedules();
            fillCurrent();
            fillChannelLinks();
            setTodayProgram();    
            initEvents();
            $('.b-page').css('display', 'block');                    
        }
    });

    // Установка выбранного дня на сегодняшний, заполнение данных
    function setTodayProgram () {
        var dayIndex = xmlTv.getCurrentScheduleDayIndex();    
        var $link = $('.b-day-menu .b-link').filter(function(index, dayLink){
            return dayIndex === $(dayLink).data('index');
        });

        $link.addClass('b-link_selected');
        $('.b-page__nav-header').text($link.attr('title'));

        if (dayIndex === 7) {
            var nearest = xmlTv.getNearestPrograms();
            fillChannels(nearest, 0, false);
        } else
            fillChannels(channels, dayIndex, false); 
    }
   
    // Заполнить программу для всех каналов для указанного дня
    function fillChannels(channels, dayIndex, isFilter) {
        var $channels = $('.b-channels');
        var channelTemplate = $.trim( $('#channelTemplate').html() );
        var programTemplate = $.trim( $('#programTemplate').html() ); 
        var programs;
        $(channels).each(function(index, channel) {
            if (isFilter)
                programs = (channel.scheduleDays[dayIndex].programmes).filter(function(program){
                    return isProgramMatchToFilter(program);
                });
            else
                programs = channel.scheduleDays[dayIndex].programmes;
            if (programs.length === 0) return;

            var channelTemp = channelTemplate.replace( /{{channelIcon}}/ig, channel.iconSrc )
                                             .replace( /{{channelTitle}}/ig, channel.name ); 
            $channels.append(channelTemp);
            var $currentChannel = $('.b-channel__programs').last();           
            var programsStr = '';          
            $(programs).each(function(index, program) {                
                var time = program.beginTime.format('HH:mm');
                var className = program.beginTime
                programsStr += programTemplate.replace( /{{programTime}}/ig, time )
                                              .replace( /{{programTitle}}/ig, program.title )
                                              .replace( /{{programId}}/ig, program.programId );
            });
            $currentChannel.append(programsStr); 
        });
    }

    // Заполнить программу всю неделю для указанного канала
    function fillDays(channel, isFilter) {
        var $channels = $('.b-channels');
        var dayTemplate = $.trim( $('#dayTemplate').html() );
        var programTemplate = $.trim( $('#programTemplate').html() );
        var programs;
        $(channel.scheduleDays).each(function(index, dayPrograms) {
            if (isFilter)
                programs = (dayPrograms.programmes).filter(function(program){
                    return isProgramMatchToFilter(program);
                });
            else
                programs = dayPrograms.programmes;
            if (programs.length === 0) return;

            var day = getDayName (index);
            var dayTemp = dayTemplate.replace( /{{dayLong}}/ig, day.long )
                                            .replace( /{{dayShort}}/ig, day.short ); 
            $channels.append(dayTemp);
            var $currentDay = $('.b-channel__programs').last();            
            var programsStr = '';            
            
            $(programs).each(function(index, program) {
                var time = program.beginTime.format('HH:mm');
                programsStr += programTemplate.replace( /{{programTime}}/ig, time)
                                              .replace( /{{programTitle}}/ig, program.title )
                                              .replace( /{{programId}}/ig, program.programId ); 
            });
            $currentDay.append(programsStr); 
        });
    }

    // Проверить подходить ли программа в условия фильтра
    function isProgramMatchToFilter(program) {
        return $.inArray(program.category, filters) != -1;                
    }

    // Заполнить программы, показываемые на данный момент в эфире
    function fillCurrent() {
        var current = xmlTv.getCurrentPrograms();        
        var $slider = $('.b-slider__list');
        var currentTemplate = $.trim( $('#slideTemplate').html() );
        var str = '';    
        
        $(current).each(function(index, program) {            
            var titleSplit = program.programTitle.split(' ');
            var titleSpan = '<span>' + titleSplit.shift() + '</span> ' + titleSplit.join(' ');

            str += currentTemplate.replace( /{{altSrc}}/ig, program.programTitle )
                              .replace( /{{title}}/ig, titleSpan )
                              .replace( /{{iconSrc}}/ig, program.iconSrc )
                              .replace( /{{time}}/ig, program.time )
                              .replace( /{{channel}}/ig, program.channelName )
                              .replace( /{{timeline}}/ig, program.elapsed );  
        });
        $slider.append(str);
        var slideImg = $('.b-program-now__icon').first().on('load', function() {
            setBodyHeight();            
        });
    }

    // Проанализировать выбранный режим и фильтры, вызвать необходимый метод заполнения в соответствии с режимом и фильтрами
    function setPrograms() {
        var isChannel = false,
            isDay = false,
            isNow = false,
            isFilter = false;

        var $currentMenu = $('.b-page__nav_curent-true');        
        var $selection = $currentMenu.find('.b-link_selected');
        var index = $selection.data("index");  
        
        if ($currentMenu.children('.b-day-menu').length > 0) {                
            if (index === 7)
                isNow = true;
            else
                isDay = true; 
        } else if ($currentMenu.children('.b-channel-menu').length > 0) {
            isChannel = true;
        } 

        if (filters.length > 0) {
            isFilter = true;
        } 

        $( ".b-page__content" ).animate({opacity: 0}, 200, function() {
                var $channels = $('.b-channels');
                $channels.empty();
                if (isDay)
                    fillChannels(channels, index, isFilter);
                else if (isChannel)
                    fillDays(xmlTv.getChannelById(index), isFilter);
                else if (isNow)
                {
                    var nearest = xmlTv.getNearestPrograms();
                    fillChannels(nearest, 0, isFilter);
                }
                initProgramHover();
                $( ".b-page__content" ).animate({opacity: 1}, 200);
            });
    }

    // Заполнить кнопки для списка каналов
    function fillChannelLinks () {
        var $channelLinks = $('.b-channel-menu .b-link-menu');
        var channelLinkTemplate = $.trim( $('#channelLinkTemplate').html() );
        var str = '';        
        $(channels).each(function(index, channel) {
            str += channelLinkTemplate.replace( /{{index}}/ig, channel.id )
                                      .replace( /{{title}}/ig, channel.name )
                                      .replace( /{{iconSrc}}/ig, channel.iconSrc );                     
        });
        $channelLinks.append(str);
        $('.b-channel-menu .b-link').first().addClass('b-link_selected');
    }

    // Получить название дня недели в соответствии с индексом
    function getDayName (dayIndex) {
        var day = {
            short : '',
            long : '',
        }
        switch (dayIndex) {
            case 0:
                day.short = "Пн";
                day.long = "Понедельник";
                break;
            case 1:
                day.short = "Вт";
                day.long = "Вторник";
                break;
            case 2:
                day.short = "Ср";
                day.long = "Среда";
                break;
            case 3:
                day.short = "Чт";
                day.long = "Четверг";
                break;
            case 4:
                day.short = "Пт";
                day.long = "Пятница";
                break;
            case 5:
                day.short = "Сб";
                day.long = "Суббота";
                break;
            case 6:
                day.short = "Вс";
                day.long = "Воскресенье";
                break;
        }
        return day;
    }

    // Подписаться на необходимые события
    function initEvents() {
        initProgramHover();

       // при скроле документа обновить позицию меню и остановить/возобновить слайдер
        $(window).scroll(function() {
            var scroll = $(window).scrollTop();
            positionNavigation(scroll);
        });

       // изменить режим отображения: меню каналов или меню дней
        $('.b-page__switch-nav').on('click', function(e) {
            var $currentMenu = $('.b-page__nav_curent-true');
            var $nextMenu = $('.b-page__nav_curent-false');
            $currentMenu.removeClass('b-page__nav_curent-true').addClass('b-page__nav_curent-false');        
            $nextMenu.removeClass('b-page__nav_curent-false').addClass('b-page__nav_curent-true');   
            e.stopPropagation(); 
            // изменить представление отображения программ                        
            setPrograms();
        });

        // при активации фильтров, подсветить кнопку .b-page__sub-nav-btn, отвечающюю за открытие меню при использовании мобильных устройств
        $('.b-filter-menu').on('click', function() {    
            var $selectedFilters = $(this).find('.b-link_selected');
            var filterButton = $('.b-page__sub-nav-btn').children('.b-link').first();
            if ($selectedFilters.length > 0)
                filterButton.addClass('b-link_selected');
            else
                filterButton.removeClass('b-link_selected');
        });   

       // установить элемент меню выделенным, проверяется возможность мультивыделения, обновить список программ
       $('.b-link-menu__item').on('click', function() {        
            var $menuLink = $(this).children('.b-link').first();         
            if ($(this).hasClass('b-link-menu__item_selection-multi')) {            
                $menuLink.toggleClass('b-link_selected');                           
                var filterLinks = $('.b-filter-menu .b-link_selected');

                filters = [];
                $.each(filterLinks, function (index, filter) {
                    filters.push($(filter).data('category'));
                });            
            } else {
                if ($menuLink.hasClass('b-link_selected')) return;            
                $menuLink.addClass('b-link_selected');
                var $siblings = $(this).siblings('.b-link-menu__item');
                $siblings.children('.b-link_selected').removeClass('b-link_selected');
                $('.b-page__nav-header').text($menuLink.attr('title'));
            }

            // обновить список программ
            setPrograms();          
        });

        // закрыть нивигационные меню по клику при исползовании мобильных устройств
        $('body').on('click', function() { 
            var $navigation = $('.b-page__navigation');
            $navigation.removeClass('b-page__navigation_open');

            var $subNavigation = $('.b-page__sub-navigation');
            $subNavigation.removeClass('b-page__sub-navigation_open');
        });
        
        // открыть меню, для мобильных устройств
        $('.b-page__nav-btn').on('click', function(e) {
            var $navigation = $('.b-page__navigation');
            $navigation.addClass('b-page__navigation_open');
            e.stopPropagation();
        });

        // открыть меню фильтров, для мобильных устройств
        $('.b-page__sub-nav-btn').on('click', function(e) {
            var $subNavigation = $('.b-page__sub-navigation');
            $subNavigation.addClass('b-page__sub-navigation_open');
            e.stopPropagation();
        });

        // предотвратить закрытие меню при нажатии на кнопку смены меню
        $('.b-page__switch-nav').on('click', function() {        
            event.stopPropagation();
        });
                
        // предотвратить скрытие всплывающего окна при наведении курсора на него
        $('.b-page__popup').hover(function() {
            isMouseOverPopup = true;
        }, function() {
            isMouseOverPopup = false;
            hidePopup();
        });
    }

    // Подписаться на наведение курсора в область программы, отобразить либо скрыть всплывающее меню
    function initProgramHover () {
        // показать детали программы при наведении на нее
        $('.b-program-info__link').hover(function() {  
            clearTimeout(showPopupDelayTimer);
            clearTimeout(hidePopupDelayTimer); 
            $this = $(this);                      
            hidePopup();   
            showPopupDelayTimer = setTimeout(function(){
                positionPopup($this);    
            }, 400);         
        }, function() {                
            clearTimeout(showPopupDelayTimer);                
            hidePopupDelayTimer = setTimeout(function(){
                if (isMouseOverPopup) return;            
                hidePopup();
            }, 200);    
        });
    }

    // Позиционировать всплывающее окно, в зависимости от доступного места, отобразить его
    function positionPopup ($link) {  
        var popupProgramId = $link.data('program-id'); 
        var icon = $('.b-program-detail__icon').first();        
        var data = xmlTv.getProgramById(popupProgramId);
        icon.attr('src', data.iconSrc);
        $('.b-program-detail__title').first().text(data.title);
        $('.b-program-detail__category').first().text(data.category);
        $('.b-program-detail__description').first().text(data.desc);
        $('.b-program-detail__age').first().text(data.rating);

        icon.one('load', function () {
            var isLeft =    false,
            isRight =   false,
            isMiddle =  false,            
            offsetTop = 0;

            var $popup = $('.b-page__popup').first();
            var popupWidth = $popup.width();
            var popupHeight = $popup.height();
            var linkBounds = $link.get(0).getBoundingClientRect();  
            var linkOffset = $link.offset();             
            var screenHeight = window.innerHeight;
            var screenWidth = window.innerWidth;
            
            if (linkBounds.right + popupWidth < screenWidth)
                isRight = true;
            else if (linkBounds.left - popupWidth > 0)
                isLeft = true;
                    
            if (isLeft || isRight) {
                var topSpace = linkBounds.top + linkBounds.height / 2;
                var bottomSpace = screenHeight - (linkBounds.top + linkBounds.height / 2);
                if (topSpace > popupHeight / 2 && bottomSpace > popupHeight / 2)
                    isMiddle = true;
                else if (topSpace < popupHeight / 2 && bottomSpace > popupHeight - topSpace)            
                    offsetTop = topSpace;            
                else if (bottomSpace < popupHeight / 2 && topSpace > popupHeight - bottomSpace)            
                    offsetTop = popupHeight - bottomSpace;            
            }                    
           
            if (isLeft && isMiddle) {
                var top = linkOffset.top + $link.height() / 2 - popupHeight / 2;
                var left = linkOffset.left - popupWidth;
                showPopup ($popup, left, top, true, popupProgramId);
            }
            else if (isLeft && offsetTop != 0) {
                var top = linkOffset.top - offsetTop;
                var left = linkOffset.left - popupWidth;
                showPopup ($popup, left, top, true);
            }                        
            else if (isRight && isMiddle ) {
                var top = linkOffset.top + $link.height() / 2 - popupHeight / 2;
                var left = linkOffset.left + $link.width() + 42;
                showPopup ($popup, left, top, true);
            }
            else if (isRight && offsetTop != 0) {
                var top = linkOffset.top - offsetTop;
                var left = linkOffset.left + $link.width() + 42;
                showPopup ($popup, left, top, true);
            }
        });
    }

    // Отобразить всплывающее окно с детализацией программы
    function showPopup ($popup, left, top, isRightDirection) {
        var shiftLeft = 0;
        if (isRightDirection)
            shiftLeft = left - 10;
        else
            shiftLeft = left + 10;
        $popup.css({
            'top': top,
            'left': shiftLeft,
            'display': 'block',
            'pointer-events': 'auto'
        });       
        $popup.animate({ opacity: 1, top: top, left: left }, 350);                    
    }
      
    // Скрыть всплывающее окно с детализацией программы
    function hidePopup () {        
        $('.b-page__popup').css({
            "opacity": 0,    
            "pointer-events": "none",
            "display": "none"
        });
    }

    // Закрепить меню дней и телеканалов и меню фильтров в зависимости от уровня скрола документа
    function positionNavigation (scroll) {
        var $headerHeight = $('.b-page__header').height();
        var $navigation = $('.b-page__navigation');
        var $subNavigation = $('.b-page__sub-navigation');
        var $pageNavBtns = $('.b-page__navigation-buttons');
        var $pageSubNavBtn = $('.b-page__sub-nav-btn');

        if (scroll > $headerHeight && window.innerHeight > 470) {
            $navigation.addClass('fixed');
            $subNavigation.addClass('fixed');
            $pageNavBtns.addClass('fixed');  
            $pageNavBtns.addClass('b-page__navigation-buttons_colored');          
        } else {
            $navigation.removeClass('fixed');
            $subNavigation.removeClass('fixed');
            $pageNavBtns.removeClass('fixed'); 
            $pageNavBtns.removeClass('b-page__navigation-buttons_colored');             
        }           
    }

    // Установить минимальную высоту .b-page__main, для предотвращения зависания футера в середине экрана
    function setBodyHeight () {
        var headerHeight = $('.b-page__header').height();
        var footerHeight = $('.b-page__footer').height();
        var windowHeight = window.innerHeight;
        var minHeight = windowHeight - headerHeight - footerHeight;
        $('.b-page__main').css('min-height', minHeight);
    }
});