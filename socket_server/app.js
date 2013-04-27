var io  = require('socket.io').listen(8080);
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var hasher = require('password-hash');
var crypto = require('crypto');
var mysql = require('mysql');
var conf = require('./config.json');
var sql = mysql.createConnection(conf);
var sql_state = false;

io.setMaxListeners(0);

sql.connect(function(err){
	if(err){
		console.log("Error connecting to DB: " + err);
		throw err;
	} else {
		sql_state = true;
	}
});

var handle_disconnect = function(err){
	if(err){
		console.log("Error_: " + JSON.stringify(err.code));
		if(err.code === "PROTOCOL_CONNECTION_LOST"){sql_state = false;}
	}
	if(!sql_state){
		var re = setInterval(function(){
			sql = mysql.createConnection(conf);
			sql.connect(function(err){
				if(err){console.log("Unable to reconnect: " + err);}
				else {
					console.log("Successfull reconnect!");
					sql.on("close", handle_connection_close);
					sql.on("error", handle_disconnect);
					sql_state = true;
					clearInterval(re);
				}
			});
		}, 5000)
	}
}
var handle_connection_close = function(err){
	console.log("DBMS closed the connection.");
	sql_state = false;
}
sql.on("close", handle_connection_close);
sql.on("error", handle_disconnect);

function findBySessionID(session_id, socket, fn) {
	r_query("SELECT COUNT(*) AS '_c', _id, login_name, display_name, email, avatar_id, hash FROM tblUser WHERE session_id = " + sql.escape(session_id), socket, function(user_data){
		if(user_data[0]._c > 0)
			return fn(null, user_data[0]);
		else
			return fn(null, null);
	});
}

function emitUserData(socket) {
	r_query("SELECT count(*) AS '_c' FROM tblUser INNER JOIN relAdmins ON tblUser._id = relAdmins.user_id WHERE tblUser.login_name = " + sql.escape(socket.login_name) + " AND relAdmins.channel_id = " + sql.escape(socket.channel_id), socket, function(admin_data){
	r_query("SELECT count(*) AS '_c' FROM tblUser INNER JOIN tblChannels ON tblUser._id = tblChannels.owner_id WHERE tblUser.login_name = " + sql.escape(socket.login_name) + " AND tblChannels._id = " + sql.escape(socket.channel_id), socket, function(owner_data){
	r_query("SELECT _id, display_name, login_name, email FROM tblUser WHERE login_name = " + sql.escape(socket.login_name), socket, function(user_data){
	r_query("SELECT tblMedia._id, position, url, caption, duration, display_name, login_name, media_type FROM tblMedia RIGHT JOIN tblUser ON tblUser._id = tblMedia.user_id WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY position ASC", socket, function(playlist_data){
	r_query("SELECT _id, start_time, url, duration FROM tblMedia WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY start_time DESC LIMIT 0,1", socket, function(current_item_data){
	r_query("SELECT timestamp, content, display_name FROM tblMessages INNER JOIN tblUser ON tblUser._id = tblMessages.user_id WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY timestamp DESC LIMIT 0, 15", socket, function(message_data){
	r_query("SELECT views, user_limit FROM tblChannels WHERE _id = " + sql.escape(socket.channel_id), socket, function(channel_data){
	r_query("SELECT COUNT(*) AS '_c' FROM relFavourites WHERE channel_id = " + sql.escape(socket.channel_id), socket, function(fav_data){
	socket.user_id = user_data[0]._id;
	r_query("SELECT COUNT(*) AS '_c' FROM relFavourites WHERE channel_id = " + sql.escape(socket.channel_id) + " AND user_id = " + sql.escape(socket.user_id), socket, function(already_faved_data){
		socket.display_name = user_data[0].display_name;
		socket.email = user_data[0].email;
		socket.already_faved = already_faved_data[0]._c === 1;
		socket.is_admin = admin_data[0]._c > 0;
		socket.is_owner = owner_data[0]._c > 0;
		if(socket.is_owner)
			socket.is_admin = true;
		socket.broadcast.to(socket.channel_id).emit('channel.user_join', { status: 0, content: { display_name: socket.display_name, login_name: socket.login_name, is_admin: socket.is_admin, user_id: socket.user_id }});
		socket.emit('channel.init', { status: 0, content: { user_data: { login_name: user_data[0].login_name, display_name: user_data[0].display_name, is_admin: socket.is_admin }, users_online: init_online(socket.channel_id), last_chat: message_data, playlist: playlist_data, already_faved: socket.already_faved, views: channel_data[0].views, favs: fav_data[0]._c, now_playing: current_item_data[0], logged_in: true }});
	});});});});});});});});});
}
function emitGuestData(socket){
	r_query("SELECT tblMedia._id, position, url, caption, duration, display_name, login_name, media_type FROM tblMedia RIGHT JOIN tblUser ON tblUser._id = tblMedia.user_id WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY position ASC", socket, function(playlist_data){
	r_query("SELECT _id, start_time, url, duration FROM tblMedia WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY start_time DESC LIMIT 0,1", socket, function(current_item_data){
	r_query("SELECT timestamp, content, display_name FROM tblMessages INNER JOIN tblUser ON tblUser._id = tblMessages.user_id WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY timestamp DESC LIMIT 0, 15", socket, function(message_data){
	r_query("SELECT views, user_limit FROM tblChannels WHERE _id = " + sql.escape(socket.channel_id), socket, function(channel_data){
	r_query("SELECT COUNT(*) AS '_c' FROM relFavourites WHERE channel_id = " + sql.escape(socket.channel_id), socket, function(fav_data){
		socket.emit('channel.init', { status: 0, content: { users_online: init_online(socket.channel_id), last_chat: message_data, playlist: playlist_data, already_faved: true, views: channel_data[0].views, favs: fav_data[0]._c, now_playing: current_item_data[0], logged_in: false }});
		socket.broadcast.to(socket.channel_id).emit('channel.guest_join');
	});});});});});
}

io.sockets.on('connection', function (socket) {
	socket.logged_in = false;
	socket.channel_id = socket.handshake.query.channel_id;
	socket.join(socket.channel_id);

	if(socket.handshake.query.session_id){
		findBySessionID(socket.handshake.query.session_id, socket, function(err, user){
			if(!user){
				socket.emit("error.session_id");
				emitGuestData(socket);
			} else {
				socket.logged_in = true;
				socket.login_name = user.login_name;
				emitUserData(socket);
			}
		});
	} else {
		emitGuestData(socket);
	}

	/* --Channel Related-- */

	socket.on('disconnect', function(){
		if(socket.logged_in)
			socket.broadcast.to(socket.channel_id).emit('channel.user_leave', { status: 0, content: { _id: socket.user_id }});
		else
			socket.broadcast.to(socket.channel_id).emit('channel.guest_leave');

		socket.leave(socket.channel_id);
	});
	socket.on('channel.faved', function(){
		if(socket.logged_in){
			if(!socket.already_faved)
				r_query("INSERT INTO relFavourites (channel_id, user_id) VALUES (" + sql.escape(socket.channel_id) + ", " + sql.escape(socket.user_id) + ")", socket, function(data){
					io.sockets.in(socket.channel_id).emit('channel.faved', { user_id: socket.user_id });
					socket.already_faved = true;
				});
			else
				r_query("DELETE FROM relFavourites WHERE channel_id = " + sql.escape(socket.channel_id) + " AND user_id = " + sql.escape(socket.user_id), socket, function(data){
					io.sockets.in(socket.channel_id).emit('channel.unfaved', { login_name: socket.login_name });
					socket.already_faved = false;
				});
		}
	});
	
	/* --User Related--*/

	socket.on('user.login', function(data){
		r_query("SELECT COUNT(*) AS '_c', hash FROM tblUser WHERE login_name = " + sql.escape(data.login_name), socket, function(user_data){
			if(user_data[0]._c > 0)
				if(hasher.verify(data.password, user_data[0].hash)){
					var session_id = hasher.generate(data.login + user_data[0].hash);
					socket.emit("user.session_id", { status: 0, content: { session_id: session_id }});
					i_query("UPDATE tblUser SET session_id = " + sql.escape(session_id) + " WHERE login_Name = " + sql.escape(data.login_name), socket, "user.login");
				} else
					socket.emit("error", { status: 4, content: { code: "Incorrect Username or _Password." }});
			else
				socket.emit("error", { status: 4, content: { code: "Incorrect _Username or Password." }});
		});
	});
	socket.on('user.logout', function(){
		if(socket.logged_in){
			i_query("UPDATE tblUser SET session_id = '' WHERE login_name = " + sql.escape(socket.login_name), socket, "user.logout");
			socket.emit("user.destroy_session");
		}
	});
	socket.on('user.create_account', function(data){
		i_query("INSERT INTO tblUser (login_name, display_name, email, strategy, hash) VALUES (" + sql.escape(data.login_name) + ", " + sql.escape(data.login_name) + ", " + sql.escape(data.email) + ", 'local', " + sql.escape(hasher.generate(data.password)) + ")", socket, "user.create_account");
	});
	
	/*--Chat Related--*/
	
	socket.on('chat.send', function(data){
		if(socket.logged_in) {
			i_query("INSERT INTO tblMessages (user_id, timestamp, channel_id, content) VALUES (" + sql.escape(socket.user_id) + ", NOW(), " + sql.escape(socket.channel_id) + ", " + sql.escape(data.content) + ")", socket, "chat.send");
			io.sockets.in(socket.channel_id).emit('chat.incoming', { status: 0, content: { display_name: socket.display_name, content: data.content, timestamp: new Date() }});
		}
	});
	socket.on('chat.load_more', function(data){
		r_query("SELECT timestamp, content, display_name FROM tblMessages INNER JOIN tblUser ON tblUser._id = tblMessages.user_id WHERE channel_id = " + sql.escape(socket.channel_id) + " AND timestamp < " + sql.escape(new Date(data.append_at)) + " ORDER BY timestamp DESC LIMIT 0, 15", socket, function(message_data){
			socket.emit('chat.load_more', message_data);
		});
	});
	
	
	
	/*--Video Related--*/
		
	socket.on('playlist.append_item', function(data){
		// Check Privileges
		if(socket.is_admin){
			r_query("SELECT position FROM tblMedia WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY position DESC LIMIT 0,1", socket, function(rows){
				console.log("append new item at " + (rows[0].position + 1));
				sql.query("INSERT INTO tblMedia (user_id, channel_id, url, position, duration, caption, media_type) VALUES (" + sql.escape(socket.user_id) + ", " + sql.escape(socket.channel_id) + ", " + sql.escape(data.url) + ", " + (rows[0].position + 1) + ", " + sql.escape(data.duration) + ", " + sql.escape(data.caption) + ", " + sql.escape(data.media_type) + ")", function(err, res){
					io.sockets.in(socket.channel_id).emit('playlist.append_item', { status: 0, content: { _id: res.insertId, position: (rows[0].position + 1), url: data.url, caption: data.caption, duration: data.duration, display_name: socket.display_name, login_name: socket.login_name, media_type: data.media_type }});
				});
			});
		}
	});
	
	socket.on('playlist.reorder', function(data){
		if(socket.is_admin){
			console.log("align items to their position");
			for(var i = 0; i < data.length; i++){
				i_query("UPDATE tblMedia SET position=" + sql.escape(data[i].position) + " WHERE _id = " + sql.escape(data[i]._id), socket, "playlist.reorder");
			}
			socket.broadcast.to(socket.channel_id).emit('playlist.reorder', { status:0, content: data});
		}
	});
	
	socket.on('playlist.play_item', function(data){
		if(socket.is_admin) {
			i_query("UPDATE tblMedia SET start_time = NOW() WHERE _id = " + sql.escape(data._id), socket, 'playlist.play_item');
			socket.broadcast.to(socket.channel_id).emit('playlist.play_item', { status: 0, content: data });
		}
	});
	socket.on('playlist.remove_item', function(data){
		if(socket.is_admin){
			r_query("SELECT _id FROM tblMedia WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY start_time DESC LIMIT 0,1", socket, function(current_data){
				if(current_data[0]._id === data._id)
					playlist_next(socket.channel_id, function(new_item){
						i_query("UPDATE tblMedia SET start_time = NOW() WHERE _id = " + sql.escape(new_item), socket, 'playlist.play_item');
						io.sockets.in(socket.channel_id).emit('playlist.play_item', { status: 0, content: { _id: new_item, start_time: new Date() }});
					});
				i_query("DELETE FROM tblMedia WHERE _id = " + sql.escape(data._id));
				io.sockets.in(socket.channel_id).emit('playlist.remove_item', { _id: data._id });
			});
			
		}
	});
	socket.on('playlist.item_changed', function(data){
		// Check if it really ended
		console.log("item changed - claim from: " + socket.login_name);
		r_query("SELECT start_time, _id, duration, caption FROM tblMedia WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY start_time DESC LIMIT 0,1", socket, function(last_data){
			if((new Date().getTime() - new Date(last_data[0].start_time).getTime()) / 1000 > last_data[0].duration) {
				// Get the next item!
				playlist_next(socket.channel_id, function(_id){
					console.log("old item " + last_data[0].caption + " outdated, new item is " + data.caption);
					i_query("UPDATE tblMedia SET start_time = NOW() WHERE _id = " + sql.escape(_id), socket, 'playlist.item_changed');
				});
			} else {
				console.log("send him back!");
				socket.emit('playlist.play_item', { status: 0, content: { _id: last_data[0]._id, start_time: last_data[0].start_time }});
			}
		});
	});
});



function r_query(statement, socket, callback) {
	sql.query(statement, function(err, rows, fields){
		if(err){
			console.log(err);
			socket.emit("error", { status: 2, content: err.code });
		} else {
			callback(rows);
		}
	});
}

function i_query(statement, socket, func_name){
	sql.query(statement, function(err){
		if(err){
			socket.emit("error", { status: 2, content: err.code });
			console.log(err);
		}
	});
}

function init_online(channel_id){
	var arr = new Array();
	io.sockets.clients(channel_id).forEach(function(socket){
		arr.push({display_name: socket.display_name, login_name: socket.login_name, is_admin: socket.is_admin, user_id: socket.user_id });
	});
	return arr;
}
function playlist_next(channel_id, done){
	sql.query("SELECT position, caption FROM tblMedia WHERE channel_id = " + sql.escape(channel_id) + " ORDER BY start_time DESC LIMIT 0,1", function(err, start_data){
		console.log("current item: " + start_data[0].caption);
		if(err)
			console.log(err);
		sql.query("SELECT COUNT(*) AS '_c', _id, caption FROM tblMedia WHERE channel_id = " + sql.escape(channel_id) + " AND position = " + (start_data[0].position + 1), function(err, next_data){
			if(err)
				console.log(err);
			if(next_data[0]._c > 0){
				done(next_data[0]._id);
				console.log("next item: " + next_data[0].caption);
			}
			else{
				sql.query("SELECT _id, caption FROM tblMedia WHERE channel_id = " + sql.escape(channel_id) + " ORDER BY start_time ASC LIMIT 0,1", function(err, first_data){
					done(first_data[0]._id);
					console.log("first item: " + first_data[0].caption);
				});
			}
		});
	});
}