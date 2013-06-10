﻿var states = ["Waiting for Server...", "Crunching Data...", "Waiting for Media-Player...", "Here you go!"];
var loading_lock = false;
var change_state = function(new_state){
	if(!loading_lock){
		current_state = new_state;
		window.document.title="SynergyTube | " + states[current_state];
		$('.txt-status').fadeOut(100, function(){
			$('.txt-status').html(states[current_state]);
		}).fadeIn(100);
		$('.bar').css('width', (current_state / (states.length - 1) * 100) + '%');
		if(new_state == states.length - 1){
			$('.wrap-the-load').fadeOut('slow');
			$('.content-wrap').fadeIn('slow');
			window.document.title="SynergyTube | " + channel_title;
			$('.channel-chat-inner > ul').animate({ scrollTop: $('.channel-chat-inner > ul')[0].scrollHeight},800);
			loading_lock = true;
		}
	}
}
var change_error = function(error_msg){
	window.document.title="SynergyTube | Error";
	$('.txt-init').html(error_msg);
	$('.txt-status').stop().hide();
	$('.upper-hr').hide();
	$('.progress').hide();
	loading_lock = true;
};
var current_state = 0;
var app = angular.module('channel', []);
var socket = null;
if(channel_error_msg){
	change_error(channel_error_msg);
} else {
	//Let's wait with the fadein till after the huge cover image has loaded :3
	$('<img/>').attr('src', $('.channel-cover').css('background-image').slice($('.channel-cover').css('background-image').indexOf('(')+1,-1)).load(function() {
		change_state(1);
	});
	if(typeof io !== "undefined")
		socket = io.connect('//' + window.location.host + ':8080', { query:"session_id=" + readCookie("session_id") + "&channel_id=" + channel_id, secure: location.protocol === "https:" });
	else
		change_error("Seems like our Servers are currently down :(");
}

var player;

$(function(){
	jQuery.event.props.push("dataTransfer");
	// I hate the chromeless player, I'll never build my own controls. Take this dummy!
	swfobject.embedSWF("http://www.youtube.com/v/xxxxxxxxxxx?enablejsapi=1&playerapiid=ytplayer&version=3&autohide=1&theme=light", "replace-player", "100%", "380", "8", null, null, { allowScriptAccess: "always" }, { id: "myytplayer" }, function(e){
		if(!e.success)
			change_error("Unable to initialize Media-Player :(<br/>Be sure to enable the Flash-Player");
	});
	$('._tt').tooltip({placement:'bottom'});
	$('.channel-cover-text').dotdotdot({watch:true});
});

function stateChangeProxy(state){angular.element('html').scope().playerStateChange(state);}
function onYouTubePlayerReady(playerId) {
	change_state(3);
	player = document.getElementById("myytplayer");
	player.addEventListener("onStateChange", "stateChangeProxy");
}

function channel_controller($scope){
	$scope.playlist = [];
	$scope.chat = [];
	$scope.online = [];
	$scope.alert_stack = [];
	$scope.show_cp = false;
	$scope.skip = { voted: false, votes: 0, goal: 1 };
	$scope.add_item = { valid: false };
	$scope.login_name = "";
	$scope.display_name = "";
	$scope.views = 0;
	$scope.favs = 0;
	$scope.guests = 0;
	// The currently active media-item-_id
	$scope.active_item = new Date();
	$scope.start_time = null;
	$scope.reordered = false;
	$scope.removed = false;
	
	socket.on('channel.init', function(data){
		change_state(2);

		console.log("received: " + data.playlist.length + " media items; " + data.last_chat.length + " messages;")
    
		$scope.channel_id = channel_id;
		$scope.playlist = data.playlist;
		
		$scope.chat = data.last_chat;
		$scope.online = data.users_online;
		$scope.guests = data.guest_online;
		$scope.favs = data.favs;
		$scope.views = data.views;
		
		if(data.now_playing){
			$scope.active_item = data.now_playing._id;
			$scope.start_time = data.now_playing.start_time;
			$scope.duration = data.now_playing.duration;
			$scope.skip.votes = data.now_playing.skip.votes;
			$scope.skip.goal = data.now_playing.skip.goal;
			$scope.skip.voted = data.now_playing.skip.already_skipped; //not there yet
		} else {
			// Throw something like: "You have to add at least one item";
		}
		
		$scope.logged_in = data.logged_in;
		$scope.already_faved = data.already_faved;
		
		if(data.logged_in){
			$scope.is_admin = data.user_data.is_admin;
			$scope.login_name = data.user_data.login_name;
			$scope.display_name = data.user_data.display_name;
			$scope.email = data.user_data.email;
			$scope.email_hash = data.user_data.email_hash;
			$scope.favourites = data.user_data.favourites;
		} else {
			$scope.is_admin = false;
		}

		var intv = setInterval(function(){
			if(player && data.now_playing){
				if((new Date().getTime() - new Date($scope.start_time).getTime()) / 1000 > $scope.duration)
					$scope.playNext();
				else {
					var start_seconds = (new Date().getTime() - new Date($scope.start_time).getTime()) / 1000;
					player.loadVideoById(data.now_playing.url, start_seconds);
				}
				clearInterval(intv);
			} else if (!player){
        console.log("waiting for player to finish initializing...");
      } else if (!data.now_playing){
        console.log("waiting for a video to be added...");
      }
		}, 1000);
		
		$scope.$apply();
		
		if(typeof $('.channel-chat > ul')[0] !== "undefined")
			$('.channel-chat > ul').scrollTop($('.channel-chat > ul')[0].scrollHeight);
	});
	socket.on('playlist.append_item', function(data){
		$scope.playlist.push(data.content);
		$scope.$apply();
	});
	socket.on('playlist.play_item', function(data){
		var start_seconds = (new Date().getTime() - new Date(data.content.start_time).getTime()) / 1000;
		var item;
		for (var i = 0; i < $scope.playlist.length; i++) {
			if($scope.playlist[i]._id === data.content._id){
				item = $scope.playlist[i];
				break;
			}
		};
		player.loadVideoById(item.url, start_seconds);
		$scope.active_item = item._id;
		$scope.$apply();
	});
	socket.on('playlist.remove_item', function(data){
		for (var i = 0; i < $scope.playlist.length; i++) {
			if($scope.playlist[i]._id === data._id){
				$scope.playlist.splice(i, 1);
				break;
			}
		};
		$scope.removed = true;
		for(var i = 0; i < $scope.playlist.length; i++){
			$scope.playlist[i].position = i + 1;
		}
		$scope.$apply();
	});
	socket.on('playlist.realign', function(data){
		// may we get this a little more efficient?
		for (var x = 0; x < $scope.playlist.length; x++) {
			for (var y = 0; y < data.content.length; y++) {
				if($scope.playlist[x]._id === data.content[y]._id)
					$scope.playlist[x].position = data.content[y].position;
			};
		};
		$scope.$apply();
	});
	socket.on('skip.vote', function(data){
		$scope.skip=data.content;
		$scope.$apply();
		if($scope.skip.votes === $scope.skip.goal)
			animate_bg($('#skips i.icon-eject'), 0, 20); //we should make the coming skip obvious
	});
	socket.on('chat.incoming', function(data){
		$scope.chat.push(data.content);
		$scope.$apply();
		$('.channel-chat-inner > ul').animate({ scrollTop: $('.channel-chat-inner > ul')[0].scrollHeight},800);
	});
	socket.on('chat.load_more', function(data){
		$scope.chat = $scope.chat.concat(data);
		$scope.$apply();
		$('.channel-chat-inner > ul').scrollTop($scope.scroll_to_item.offset().top - $('.channel-chat-inner > ul').offset().top + $('.channel-chat-inner > ul').scrollTop());
		if(data.length !== 0){
			$scope.scroll_load_blocked = false;
		}
		$('.channel-chat > ul > .loading-more').remove();
	});
	socket.on('channel.user_join', function(data){
		$scope.online.push(data.content);
		$scope.$apply();
	});
	socket.on('channel.user_leave', function(data){
		for (var i = 0; i < $scope.online.length; i++) {
			if($scope.online[i].user_id === data._id){
				$scope.online.splice(i, 1);
				break;
			}
		};
		$scope.$apply();
	});
	socket.on('channel.guest_join', function(){
		$scope.guests++;
		$scope.$apply();
	});
	socket.on('channel.guest_leave', function(){
		$scope.guests--;
		$scope.$apply();
	});
	socket.on('channel.faved', function(data){
		$scope.favs++;
		if(data.login_name === $scope.login_name)
			$scope.already_faved = true;
		$scope.$apply();
	});
	socket.on('channel.unfaved', function(data){
		$scope.favs--;
		if(data.login_name === $scope.login_name)
			$scope.already_faved = false;
		$scope.$apply();
	});
	socket.socket.on('error', function(data){
		$scope.alert_stack.push({ status: "Server-Error", text: "Lost connection to the Server" });
		$scope.$apply();
	});
	socket.on('error', function(data){
		$scope.alert_stack.push(data);
		$scope.$apply();
	});
	socket.on('error.session_id', function(){
		console.log("not logged in");
		if(readCookie("firstvisit") !== "false"){
			$scope.alert_stack.push({ text: "You don't seem to be logged in. If you use SynergyTube without registration you are not able to Chat." });
			$scope.$apply();
			createCookie("firstvisit", "false");
		}
	});
	socket.on('error.channel_full', function(){
		console.log("channel full");
		change_error("Sorry, this Channel has reached its User-Limit. Come back soon!");
	});
  
	socket.on('user.session_id', function(data){
		createCookie("session_id", data.content.session_id);
		$scope.password = "";
		$scope.txtlogin_name = "";
		window.location.reload();
	});
	socket.on('user.destroy_session', function(){
		eraseCookie("session_id");
		window.location.reload();
	});
	socket.on("user.create_account", function(){
		$('.create-an-account-dropdown').dropdown('toggle');
		$scope.alert_stack.push({ text: "Huray! We've created your account! Go check your Emails for the confirmation link in order to activate your Account." });
		$scope.$apply();
	});
  
	$scope.debug = function(){
		alert("Debug-Message");
	}
	$scope.login = function(){
    console.log('login request sent');
		socket.emit('user.login', { login_name: $scope.txtlogin_name, password: $scope.password  });
	}
	$scope.logout = function(){
		socket.emit('user.logout');
	}
	$scope.create_account = function() {
		socket.emit('user.create_account', { login_name: $scope.create_login_name, email: $scope.email, password: $scope.create_password });
		$scope.create_login_name = "";
		$scope.email = "";
		$scope.create_password = "";
	}
	$scope.sendMessage = function(){
		if($scope.message)
			socket.emit('chat.send', { content: $scope.message });
		$scope.message = '';
	};

	// Toggles the control panel
	$scope.toggle_cp = function(){
    if($scope.show_cp==false){
      $scope.show_cp=true;
      $('.channel-cover-cp').slideDown();
    } else {
      $scope.show_cp=false;
      $('.channel-cover-cp').slideUp();
    }
	};
  
	$scope.dismiss_alert = function(alert){
		$scope.alert_stack.splice($scope.alert_stack.indexOf(alert), 1);
	};
	
	$scope.getTime = function(t){
		t = new Date(t);
		return (t.getHours() < 10 ? '0' : '') + t.getHours() + ":" + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes();
	};
	$scope.getDate = function(d){
		d = new Date(d);
		return (d.getDate() < 10 ? '0' : '') + d.getDate() + "." + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + "." + d.getFullYear() + " " + $scope.getTime(d);
	}
	$scope.getLength = function(s){
		s = new Date(s * 1000);
		return (s.getMinutes() < 10 ? '0' : '') + s.getMinutes() + ":" + (s.getSeconds() < 10 ? '0' : '') + s.getSeconds();
	};

	$scope.playerStateChange = function(state) {
		if(state === 0){
			console.log("Media_Item ended");
			$scope.playNext();
		}
	};
	$scope.skip_vote = function(){
		if(!$scope.skip.voted){
			$scope.skip.voted = true;
			socket.emit('skip.vote'); //Now do that on the server side, too.
		}
	}
	$scope.playNext = function() {
		var pos = -1;
		var next_item = null;
		// This'll be a torture!
		for (var i = 0; i < $scope.playlist.length; i++) {
			if($scope.playlist[i]._id === $scope.active_item)
				pos = $scope.playlist[i].position;
			if(pos !== -1)
				if($scope.playlist[i].position === pos + 1)
					next_item = $scope.playlist[i];
		}
		if(next_item === null)
			for (var i = 0; i < $scope.playlist.length; i++)
				if($scope.playlist[i].position === pos + 1)
					next_item = $scope.playlist[i];
		if(next_item === null)
			for (var i = 0; i < $scope.playlist.length; i++)
				if($scope.playlist[i].position === 1)
					next_item = $scope.playlist[i];

		console.log("Old pos: " + pos + " New pos: " + next_item.position);
		$scope.active_item = next_item._id;
		$scope.$apply();
		player.loadVideoById(next_item.url);
		socket.emit('playlist.item_changed', { caption: next_item.caption });
	};
	$scope.play_item = function(item_id){
		var item;
		for (var i = 0; i < $scope.playlist.length; i++) {
			if($scope.playlist[i]._id === item_id)
				item = $scope.playlist[i];
		};
		socket.emit('playlist.play_item', { _id: item_id, start_time: new Date() });
	};
	$scope.add_new_item = function(){
		socket.emit('playlist.append_item', { url:$scope.add_item.url, duration:$scope.add_item.duration, caption:$scope.add_item.caption, media_type: $scope.add_item.media_type});
		$scope.show_add = false;
		$scope.add_item = { valid:false };
		$scope.itemURL = "";
	};
	$scope.remove_item = function(item_id){
		socket.emit('playlist.remove_item', { _id: item_id });
	}
	$scope.fav_this = function(){
		socket.emit('channel.faved');
	};

	// Toggles between the textboxes
	$scope.show_pl_bars = function(show_add, show_search){
		if(($scope.show_add && show_add) || !show_add)
			$scope.show_add = false;
		else
			$scope.show_add = show_add;
		if(($scope.show_search && show_search) || !show_search)
			$scope.show_search = false
		else
			$scope.show_search = show_search;

		$scope.add_item = { valid: false };
		$scope.searchTitle = "";
		$scope.itemURL = "";

		// why this hack? dunno, but won't work otherwise
		setTimeout(function(){
			if($scope.show_search)
				$('#searchTextbox').focus();
			else
				$('#addTextbox').focus();
		}, 100);
	};
	$scope.playlist_center_current = function(){
		setTimeout(function(){//This timeout is just because otherwise jQuery would be lookign for .playc before angular had updated it and thusly the scroll would be a step behind.
			$('.playlist > .playlist-table').animate({ scrollTop: //Get out the geometry textbook faggot
				$('.playlist-table > tbody').height()*($('.playlist-table > tbody tr').index($('.playc'))/$('.playlist-table > tbody tr').length)-($('.playlist-table').height()/2)+($('.playc').height()/1.5)
			},400);
		},0);
	}

	$scope.itemUrlCallback = function(){
		var youtube_reg = $('#addTextbox').val().match(/(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/);
		if(youtube_reg){
			$.getJSON("https://gdata.youtube.com/feeds/api/videos/" + youtube_reg[1] + "?alt=json-in-script&v=2&callback=?", function(data){
				if(data.entry) {
					for(var i = 0; i < data.entry.media$group.media$content.length; i++){
						if(data.entry.media$group.media$content[i].yt$format === 5){
							$scope.add_item.valid = true;
							break;
						}
					};
					if($scope.add_item.valid){
						$scope.add_item.url = data.entry.media$group.yt$videoid.$t;
						$scope.add_item.duration = data.entry.media$group.media$content[0].duration;
						$scope.add_item.caption = data.entry.title.$t;
						$scope.add_item.media_type = "youtube";
						for (var i = 0; i < $scope.playlist.length; i++) {
							if($scope.playlist[i].url == $scope.add_item.url){
								$scope.alert_stack.push({ text: "The Item you are about to add is already in the Media List. Are you sure about adding this?" });
								break;
							}
						};
					} else {
						$scope.alert_stack.push({ text: "This Item is not embeddable." });
					}
				} else {
					$scope.add_item.valid = false;
				}
				$scope.$apply();
			});
		} else {
			angular.element('html').scope().add_item.valid = false;
			angular.element('html').scope().$apply();
		}
	};
	$scope.load_messages = function(){
		if(!$scope.scroll_load_blocked){
			$scope.scroll_to_item = $('.channel-chat-inner > ul > li:first-child');
			$('.channel-chat > ul').prepend('<li class="loading-more"><h3>Loading more..</h3></li>');
			$scope.scroll_load_blocked = true;
			socket.emit('chat.load_more', { append_at: $scope.chat[$scope.chat.length - 1].timestamp });
		}
	};
	
	$scope.$watch("playlist", function(value){
		if($scope.reordered || $scope.removed){
			var r = value.map(function(e){ return { _id: e._id, position: e.position }; });
			socket.emit('playlist.realign', r);
		}
	}, true);
	$scope.$watch("active_item", function(){
		$scope.playlist_center_current();
	});
}

app.directive('dndList', function(){
	return function(scope, element, attrs){
		var toUpdate;
		var startIndex = -1;
		
		scope.$watch(attrs.dndList, function(value){
			toUpdate = value;
		},true);

		var intv = setInterval(function(){
			console.log("waiting for socket.io to finish initializing...");
			if(typeof scope.logged_in !== "undefined"){
				if(scope.is_admin)
					$(element[0]).sortable({
						items:'tr',
						start: function(event, ui){
							startIndex = ($(ui.item).index());
							scope.reordered = true;
						},
						stop: function(event, ui){
							console.log("Item: " + toUpdate[startIndex]._id + "; Old Position: " + toUpdate[startIndex].position + "; New Position: " + ($(ui.item).index() + 1));
							var newIndex = ($(ui.item).index());
							var toMove = toUpdate[startIndex];
							toUpdate.splice(startIndex, 1);
							toUpdate.splice(newIndex,0,toMove);
							for(var i = 0; i < scope.playlist.length; i++){
								scope.playlist[i].position = i + 1;
							}
							scope.$apply(scope.playlist);
						},
						axis: 'y'
					});
				clearInterval(intv);
			}
		}, 1000);
	};
});

//funny that jquery won't do this itself
function animate_bg(ele, from, to) {
    ele.css("background-color", "rgba(255, 127, 127, " + (from += from > to ? -1 : 1) / 10 + ")"); 
    if(from != to)  
        setTimeout(function() {