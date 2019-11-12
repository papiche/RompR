var communityRadioPlugin = {

    prepopulated: ['countries', 'languages', 'tags'],

    loadBigRadio: function() {
        if ($("#communityradiolist").hasClass('notfilled')) {
            $('i[name="communityradiolist"]').makeSpinner();
            $("#communityradiolist").load('streamplugins/04_communityradio.php?populate=1&page=0&order=none',
                function() {
                    $('i[name="communityradiolist"]').stopSpinner();
                    $('#communityradiolist').removeClass('notfilled');
                    communityRadioPlugin.setTheThing();
                    uiHelper.hackForSkinsThatModifyStuff("#communitystations");
                    layoutProcessor.postAlbumActions();
                }
            );
        }
    },

    page: function(el) {
        el.off('click').makeSpinner();
        var parent = el;
        while (!(parent.hasClass('dropmenu') || parent.hasClass('invisible'))) {
            parent = parent.parent();
        }
        var id = parent.attr('id');
        var url = parent.children('input').first().val();
        var title = parent.children('input').last().val();
        var page = el.attr('name');
        communityRadioPlugin.browse(url, title, page, id, function() {
            el.stopSpinner();
            uiHelper.hackForSkinsThatModifyStuff("#"+id);
            layoutProcessor.postAlbumActions();
        });
    },

    search: function(page) {
        $('#communitystations').empty();
        doSomethingUseful('communitystations', language.gettext('label_searching'));
        var uri = 'streamplugins/04_communityradio.php?populate=3'
                '&order='+prefs.communityradioorderby;
        var foundterm = false;
        $('.comm_radio_searchterm').each(function() {
            if ($(this).val() != '') {
                foundterm = true;
                uri += '&'+$(this).attr('name')+'='+encodeURIComponent($(this).val());
            }
        });
        if (!foundterm) {
            uri = 'streamplugins/04_communityradio.php?populate=4';
        }
        $('#communitystations').load(uri, function() {
            uiHelper.hackForSkinsThatModifyStuff("#communitystations");
            layoutProcessor.postAlbumActions();
        });
    },

    setTheThing: function() {
        $('button[name="commradiosearch"]').on('click', communityRadioPlugin.search);
        var w = 0;
        $.each($(".cslt"), function() {
            if ($(this).width() > w) {
                w = $(this).width();
            }
        });
        w += 8;
        $(".comm-search-label").css("width", w+"px");
        $('#communityradioorderbyselector').val(prefs.communityradioorderby);
    },

    browse: function(url, title, page, target, callback) {
        $("#"+target).load("streamplugins/04_communityradio.php?populate=2&url="+url+'&order='+prefs.communityradioorderby+'&page='+page+'&title='+title, function() {
            callback();
        });
    },

    handleClick: function(event, clickedElement) {
        debug.log("COMM RADIO", "Handling Click");
        if (clickedElement.hasClass("browse")) {
            event.stopImmediatePropagation();
            var url = clickedElement.prev().prev().val();
            var title = clickedElement.prev().val();
            if (!clickedElement.hasClass('filled') && communityRadioPlugin.prepopulated.indexOf(url) == -1 && clickedElement.isClosed()) {
                clickedElement.makeSpinner();
                var menutoopen = clickedElement.attr("name");
                communityRadioPlugin.browse(url, title, 0, menutoopen, function() {
                    clickedElement.stopSpinner().addClass('filled');
                    doMenu(null, clickedElement);
                });
            } else {
                doMenu(null, clickedElement);
            }
        } else if (clickedElement.hasClass('clickcommradiopager')) {
            communityRadioPlugin.page(clickedElement);
        }
    }
}

menuOpeners['communityradiolist'] = communityRadioPlugin.loadBigRadio;
clickRegistry.addClickHandlers('commradio', communityRadioPlugin.handleClick);
