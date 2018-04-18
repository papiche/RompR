var podcasts = function() {

	var downloadQueue = new Array();
	var downloadRunning = false;
	var loaded = false;
	var refreshtimer;

	function checkDownloadQueue() {
		if (downloadRunning == false) {
			var newTrack = downloadQueue.shift();
			if (newTrack) {
				downloadRunning = true;
				var track = newTrack.track;
				var channel = newTrack.channel;
		    	$('[name="podgroupload_'+channel+'"]').makeFlasher().removeClass('podgroupload');
				var monitor = new podcastDownloadMonitor(track, channel);
			    $.ajax( {
			        type: "GET",
			        url: "includes/podcasts.php",
			        cache: false,
			        contentType: "text/html; charset=utf-8",
			        data: {downloadtrack: track, channel: channel, populate: 1 },
			        timeout: 360000,
			        success: function(data) {
			            monitor.stop();
			            $("#podcast_"+channel).html(data);
			            $("#podcast_"+channel).find('.fridge').tipTip({edgeOffset: 8});
			            doDummyProgressBars();
			            downloadRunning = false;
				    	$('[name="podgroupload_'+channel+'"]').stopFlasher().removeClass('podgroupload').addClass('podgroupload');
			            checkDownloadQueue();
			        },
			        error: function(data, status) {
			            monitor.stop();
			            $("#podcastdownload").remove();
			            debug.error("PODCASTS", "Podcast Download Failed!",data,status);
			            infobar.notify(infobar.ERROR, "Failed To Download Podcast");
			            downloadRunning = false;
				    	$('[name="podgroupload_'+channel+'"]').stopFlasher().removeClass('podgroupload').addClass('podgroupload');
			            checkDownloadQueue();
			        }
			    });
			} else {
		    	$('[name^="podgroupdownload_"]').stopFlasher();

			}
		}
	}

	function podcastDownloadMonitor(track, channel) {

	    var self = this;
	    var progressdiv = $('i[name="poddownload_'+track+'"]').parent();
	    progressdiv.html('<div id="podcastdownload" width="100%"></div>');
	    progressdiv.rangechooser({range: 100, startmax: 0, interactive: false});
	    var timer;
	    var running = true;

	    this.checkProgress = function() {
	        $.ajax( {
	            type: "GET",
	            url: "utils/checkpodcastdownload.php",
	            cache: false,
	            dataType: "json",
	            success: function(data) {
	                progressdiv.rangechooser('setProgress', data.percent);
	                debug.log("PODCAST DOWNLOAD","Download status is",data);
	                if (running) {
	                    timer = setTimeout(self.checkProgress, 500);
	                }
	            },
	            error: function() {
	                infobar.notify(infobar.ERROR, "Something went wrong checking the download progress!");
	            }
	        });
	    }

	    this.stop = function() {
	        running = false;
	        clearTimeout(timer);
	        pb = null;
	    }

	    timer = setTimeout(self.checkProgress, 2000);
	}

	function doDummyProgressBars() {
		for(var i = 0; i < downloadQueue.length; i++) {
			var track = downloadQueue[i].track;
			debug.trace("PODCAST DOWNLOAD","Putting Dummy Progress Bar in",track);
		    $('i[name="poddownload_'+track+'"]').makeSpinner();
		}
	}

	function putPodCount(element, num, numl) {
		debug.log("PODCASTS","Updating counts",element,num,numl);
		var indicator = $(element);
		if (num == 0) {
			indicator.removeClass('newpod');
			indicator.html("");
		} else {
			indicator.html(num);
			if (!indicator.hasClass('newpod')) {
				indicator.addClass('newpod');
			}
		}
		var il = indicator.next();
		if (numl == 0) {
			il.removeClass('unlistenedpod');
			il.html("");
		} else {
			il.html(numl);
			if (!il.hasClass('unlistenedpod')) {
				il.addClass('unlistenedpod');
			}
		}
	}

	function podcastRequest(options, callback) {
		debug.log("PODCASTS","Sending request",options);
		options.populate = 1;
		if (options.channel) {
			var term = $('[name="podsearcher_'+options.channel+'"]').val();
			if (typeof term !== 'undefined' && term != '') {
				options.searchterm = encodeURIComponent(term);
			}
		}
	    $.ajax( {
	        type: "GET",
	        url: "includes/podcasts.php",
	        cache: false,
	        contentType: "text/html; charset=utf-8",
	        data: options,
	        success: function(data) {
	            $("#podcast_"+options.channel).html(data);
	            $("#podcast_"+options.channel).find('.fridge').tipTip({edgeOffset: 8});
		        $("#podcast_"+options.channel).find('.clearbox').click(function(event){
		            event.preventDefault();
		            event.stopPropagation();
		            var position = getPosition(event);
		            var elemright = $(event.target).width() + $(event.target).offset().left;
		            if (position.x > elemright - 24) {
		                $(event.target).val("");
		                var thing = $(event.target).attr('name').replace(/podsearcher_/,'');
		                podcasts.searchinpodcast(thing);
		            }
		        }).hover(makeHoverWork).mousemove(makeHoverWork).keyup(onKeyUp);
	            if (callback !== null) {
	            	callback();
	            }
	            podcasts.doNewCount();
	        },
	        error: function(data, status) {
	            debug.error("PODCASTS", "Failed To Set Option:",options,data,status);
	            infobar.notify(infobar.ERROR,language.gettext("label_general_error"));
	        }
	    });

	}

	function loadPodcast(channel) {
		var target = $('#podcast_'+channel);
		var uri = "includes/podcasts.php?populate=1&loadchannel="+channel;
		var term = $('[name="podsearcher_'+channel+'"]').val();
		if (typeof term !== 'undefined' && term != '') {
			uri += '&searchterm='+encodeURIComponent(term);
		}
		$('[name="podcast_'+channel+'"]').makeSpinner();
		target.load(uri, function() {
			$('[name="podcast_'+channel+'"]').stopSpinner();
			if ($('[name="podcast_'+channel+'"]').isClosed()) {
				$('[name="podcast_'+channel+'"]').toggleOpen();
	        	target.menuReveal();
	        }
            target.find('.fridge').tipTip({edgeOffset: 8});
	        target.find('.clearbox').click(function(event){
	            event.preventDefault();
	            event.stopPropagation();
	            var position = getPosition(event);
	            var elemright = $(event.target).width() + $(event.target).offset().left;
	            if (position.x > elemright - 24) {
	                $(event.target).val("");
	                var thing = $(event.target).attr('name').replace(/podsearcher_/,'');
	                podcasts.searchinpodcast(thing);
	            }
	        }).hover(makeHoverWork).mousemove(makeHoverWork).keyup(onKeyUp);
            if (target.find('.podautodown').is(':checked')) {
	            target.find('.podnewdownload').click();
            }
		});
	}

	function getPodcast(url) {
	    debug.log("PODCAST","Getting podcast",url);
	    infobar.notify(infobar.NOTIFY, "Subscribing to Podcast....")
	    doSomethingUseful('cocksausage', language.gettext("label_downloading"));
	    $.ajax( {
	        type: "GET",
	        url: "includes/podcasts.php",
	        cache: false,
	        contentType: "text/html; charset=utf-8",
	        data: {url: encodeURIComponent(url), populate: 1 },
	        success: function(data) {
	            $("#fruitbat").html(data);
	            $("#fruitbat").find('.fridge').tipTip({edgeOffset: 8});
	            infobar.notify(infobar.NOTIFY, "Subscribed to Podcast");
	            podcasts.doNewCount();
				$('#spinner_cocksausage').remove();
	        },
	        error: function(data, status, thing) {
	            infobar.notify(infobar.ERROR, "Failed to Subscribe to Podcast : "+data.responseText);
	            $('#spinner_cocksausage').remove();
	        }
	    } );
	}

	return {

    	loadPod: function(event, element) {
		    if (event) {
		        event.stopImmediatePropagation();
		    }
		    var menutoopen = element.attr("name");
		    if (element.isClosed()) {
		    	if ($("#"+menutoopen).is(':empty')) {
		    		debug.log("PODCASTS","Loading",menutoopen);
		    		loadPodcast(element.attr('romprpod'));
		    	} else {
	            	$('#'+menutoopen).menuReveal();
		    		element.toggleOpen();
		    	}
		    } else {
		        $('#'+menutoopen).menuHide();
		        element.toggleClosed();
		    }
	        if (layoutProcessor.postAlbumMenu) {
		        layoutProcessor.postAlbumMenu(element);
    		}
		    return false;
    	},

    	searchinpodcast: function(channel) {
    		var term = $('[name="podsearcher_'+channel+'"]').val();
    		debug.log("PODCASTS","Searching podcast",channel,'for',term);
    		loadPodcast(channel);
    	},

		doPodcast: function(input) {
		    var url = $("#"+input).val();
		    getPodcast(url);
		},

		handleDrop: function() {
    		setTimeout(function() { podcasts.doPodcast('podcastsinput') }, 1000);
    	},

    	channelAction: function(channel, action) {
    		debug.mark("PODCAST","Action",action," on podcast ",channel);
    		var data = {populate: 1};
    		data[action] = channel;
    		$('.podaction[name="'+action+'_'+channel+'"]').makeSpinner();
		    $.ajax( {
		        type: "GET",
		        url: "includes/podcasts.php",
		        cache: false,
		        contentType: "text/html; charset=utf-8",
		        data: data,
		        success: function(data) {
    				$('.podaction[name="'+action+'_'+channel+'"]').stopSpinner();
		            $("#podcast_"+channel).html(data);
		            $("#podcast_"+channel).find('.fridge').tipTip({edgeOffset: 8});
		            podcasts.doNewCount();
		        },
		        error: function(data, status) {
		            infobar.notify(infobar.ERROR, language.gettext("podcast_general_error"));
		    		$('.podaction[name="'+action+'_'+channel+'"]').stopSpinner();
		        }
		    } );
    	},

		removePodcastTrack: function(track, channel) {
		    debug.log("PODCAST","Removing track",track,"from channel",channel);
		    podcastRequest({removetrack: track, channel: channel },null);
		},

		markEpisodeAsListened: function(track, channel) {
		    debug.log("PODCAST","Marking track",track,"from channel",channel,"as listened");
		    podcastRequest({markaslistened: track, channel: channel },null);
		},

		downloadPodcast: function(track, channel) {
		    debug.mark("PODCAST","Downloading track",track,"from channel",channel);
		    downloadQueue.push({track: track, channel: channel});
		    doDummyProgressBars();
		    checkDownloadQueue();
		},

		downloadPodcastChannel: function(channel) {
            $("#podcast_"+channel).find('.poddownload').click();
		},

		checkMarkPodcastAsListened: function(file) {
	        var p = $("#fruitbat").find('div[name="'+file+'"]');
	        var divid = null;
	        debug.log("PODCASTS","Looking for podcast",file,p.length);
	        if (p.length == 1) {
	            divid = p.parent().attr("id");
	            debug.log("PODCASTS", "We just listened to an episode from podcast",divid);
	        }
            $.ajax( {
                type: "GET",
                url: "includes/podcasts.php",
                cache: false,
                contentType: "text/html; charset=utf-8",
                data: {listened: encodeURIComponent(file), populate: 1},
                success: function(data) {
                	if (divid) {
	                    $("#"+divid).html(data);
	                    $("#"+divid).find('.fridge').tipTip({edgeOffset: 8});
			        }
		            podcasts.doNewCount();
                },
                error: function(data, status) {
                    debug.error("PODCASTS","Failed to mark",file,"as listened");
                }
            } );
		},

		doNewCount: function() {
			$.getJSON("includes/podcasts.php?populate=1&getcounts=1", function(data) {
				$.each(data, function(index, value) {
					var element;
					if (index == 'totals') {
						element = '#total_unlistened_podcasts';
					} else {
						element = '#podnumber_'+index;
					}
					putPodCount(element, value.new, value.unlistened)
				});
			});
		},

		changeOption: function(event) {
			var element = $(event.target);
			var elementType = element[0].tagName;
			var options = {option: element.attr("name")};
			var callback = null;
			debug.log("PODCASTS","Option:",element,elementType);
			switch(elementType) {
				case "SELECT":
					options.val = element.val();
					break;
				case "LABEL":
					options.val = !element.prev().is(':checked');
					break;
			}
			while(!element.hasClass('dropmenu')) {
				element = element.parent();
			}
			var channel = element.attr('id');
			options.channel = channel.replace(/podconf_/,'');
			if (options.option == 'RefreshOption') {
				callback = podcasts.checkRefresh;
			}
			podcastRequest(options, callback);
		},

		checkRefresh: function() {
			clearTimeout(refreshtimer);
			$.getJSON("includes/podcasts.php?populate=1&checkrefresh=1", function(data) {
				debug.log("PODCASTS","Refresh result",data);
				if (data.updated && data.updated.length > 0) {
					if (loaded) {
						$.each(data.updated, function(index, value){
							if (!($('#podcast_'+value).is(':empty'))) {
								debug.log("PODCASTS","Podcast",value,"was refreshed and is loaded - reloading it");
					    		$('#podcast_'+value).load("includes/podcasts.php?populate=1&loadchannel="+value, function() {
					            	$('#podcast_'+value).find('.fridge').tipTip({edgeOffset: 8});
					            });
							}
						});
					}
					podcasts.doNewCount();
				}
				if (data.nextupdate) {
					debug.log("PODCASTS","Setting next podcast refresh for",data.nextupdate,'seconds');
					refreshtimer = setTimeout(podcasts.checkRefresh, data.nextupdate*1000);
				}
			});
		},

		removePodcast: function(name) {
		    debug.log("PODCAST","Removing podcast",name);
		    $.ajax( {
		        type: "GET",
		        url: "includes/podcasts.php",
		        cache: false,
		        contentType: "text/html; charset=utf-8",
		        data: {remove: name, populate: 1 },
		        success: function(data) {
		            $("#fruitbat").html(data);
		            $("#fruitbat").find('.fridge').tipTip({edgeOffset: 8});
		            podcasts.doNewCount();
		        },
		        error: function(data, status) {
		            infobar.notify(infobar.ERROR, language.gettext("podcast_remove_error"));
		        }
		    } );
		},

		doInitialRefresh: function() {
			clearTimeout(refreshtimer);
			refreshtimer = setTimeout(podcasts.checkRefresh, 10000);
		},

		search: function() {
		    doSomethingUseful('cocksausage', language.gettext("label_searching"));
			var term = $('#podcastsearch').val();
			$('#podcast_search').empty();
		    $.ajax( {
		        type: "GET",
		        url: "includes/podcasts.php",
		        cache: false,
		        contentType: "text/html; charset=utf-8",
		        data: {search: encodeURIComponent(term), populate: 1 },
		        success: function(data) {
		            $("#podcast_search").html(data);
		            $('#podcast_search').prepend('<div class="menuitem containerbox padright"><div class="configtitle textcentre expand"><h3>Search Results for '+term+'</h3></div><i class="clickable clickicon podicon icon-cancel-circled removepodsearch fixed"></i></div>');
		            $('#podcast_search').append('<div class="configtitle textcentre fullwidth"><h3>Subscribed Podcasts</h3></div>');
		            $("#podcast_search").find('.fridge').tipTip({edgeOffset: 8});
					$('#spinner_cocksausage').remove();
		        },
		        error: function(data, status, thing) {
		            infobar.notify(infobar.ERROR, "Search Failed : "+data.responseText);
		            $('#spinner_cocksausage').remove();
		        }
		    } );
		},

		clearsearch: function() {
			$('#podcast_search').empty();
			$('#podsclear').hide();
		},

		subscribe: function(index, clickedElement) {
			clickedElement.makeSpinner().removeClass('clickable');
		    $.ajax( {
		        type: "GET",
		        url: "includes/podcasts.php",
		        cache: false,
		        contentType: "text/html; charset=utf-8",
		        data: {subscribe: index, populate: 1 },
		        success: function(data) {
		        	$('[name="podcast_'+index+'"]').parent().fadeOut('fast');
		        	$('#podcast_'+index).remove();
		            $("#fruitbat").html(data);
		            $("#fruitbat").find('.fridge').tipTip({edgeOffset: 8});
		            infobar.notify(infobar.NOTIFY, "Subscribed to Podcast");
		            podcasts.doNewCount();
		        },
		        error: function(data, status, thing) {
		            infobar.notify(infobar.ERROR, "Subscribe Failed : "+data.responseText);
		            $('#spinner_cocksausage').remove();
		        }
		    } );
		},

		removeSearch: function() {
			$('#podcast_search').empty();
		}

	}

}();

$('#podcastsinput').on('drop', podcasts.handleDrop)
podcasts.doInitialRefresh();
