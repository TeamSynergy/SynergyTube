var io  = require('socket.io').listen(8080);
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mysql = require('mysql');
var sql = mysql.createConnection({
	user: 'root',
	password: 'root',
	database: 'synergy'
});

sql.connect(function(err){
	if(err) throw err;
});

passport.use(new LocalStrategy(
	function(username, password, done){
		User.findOne({ username: username }, function(err, user){
			if(err)
				return done(err);
			if(!user)
				return done(null, false, { message: 'Incorrect username.' });
			if(!user.validPassword(password))
				return done(null, false, { message: 'Invalid Password.' });
			return done(null, user);
		});
	}
));

io.sockets.on('connection', function (socket) {
	
	
	socket.on('channel.init', function(data){
		// Check credentials
		
		socket.channel_id = data.channel_id;
		socket.login_name = data.login_name;
		
		socket.join(socket.channel_id);

		r_query("SELECT _id, display_name, email FROM tblUser WHERE login_name = " + sql.escape(socket.login_name), socket, function(user_data){
			r_query("SELECT tblMedia._id, position, url, caption, duration, display_name, login_name FROM tblMedia RIGHT JOIN tblUser ON tblUser._id = tblMedia.user_id WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY position DESC", socket, function(playlist_data){
				r_query("SELECT _id, start_time, url FROM tblMedia WHERE _id = " + sql.escape(socket.channel_id) + " ORDER BY start_time DESC LIMIT 0,1", socket, function(current_item_data){
					r_query("SELECT timestamp, content, display_name FROM tblMessages INNER JOIN tblUser ON tblUser._id = tblMessages.user_id WHERE channel_id = " + sql.escape(socket.channel_id) + " ORDER BY timestamp DESC LIMIT 0, 15", socket, function(message_data){
						var tmt = new Date();
						tmt.setMinutes(tmt.getMinutes() - 1);
						socket.user_id = user_data[0]._id;
						socket.display_name = user_data[0].display_name;
						socket.email = user_data[0].email;
						socket.level = 2;

						socket.broadcast.to(socket.channel_id).emit('channel.user_join', { status: 0, data: { display_name: user_data.display_name, login_name: data.login_name, level: 2, user_id: user_data._id }});
						socket.emit('channel.init', { status: 0, content: { users_online: init_online(socket.channel_id), last_chat: message_data, playlist: playlist_data, favourites: 12, views: 1357, now_playing: { _id: current_item_data[0]._id, start_time: current_item_data[0].start_time, url: current_item_data[0].url }}});
					});
				});
			});
		});
	});
	
	socket.on('disconnect', function(){
		socket.broadcast.to(socket.channel_id).emit('channel.user_leave', { status: 0, display_name: socket.user_name });
		socket.leave(socket.channel_id);
	});
	
	
	
	/*--Chat Related--*/
	
	socket.on('chat.send', function(data){
		i_query("INSERT INTO tblMessages (user_id, timestamp, channel_id, content) VALUES (" + sql.escape(socket.user_id) + ", NOW(), " + sql.escape(socket.channel_id) + ", " + sql.escape(data.content) + ")", socket, "chat.send");
		io.sockets.in(socket.channel_id).emit('chat.incoming', { status: 0, content: { display_name: socket.display_name, content: data.content, timestamp: new Date() }});
	});
	
	
	
	/*--Video Related--*/
		
	socket.on('playlist.append_item', function(data){
		// Check Privileges
		i_query("INSERT INTO tblVideos (user_id, channel_id, url, pos, duration) VALUES (" + socket.user_id + ", " + socket.channel_id + ", '" + sql.escape(data) + "', LAST?!?!, LENGTH?!?!)", socket, "playlist.append_item");
		io.sockets.in(socket.channel_id).emit('playlist.append_item', data );
	});
	
	socket.on('playlist.reorder', function(data){
		for(var i = 0; i < data.length; i++){
			i_query("UPDATE tblMedia SET position=" + (data[i].position) + " WHERE _id = " + sql.escape(data[i]._id), socket, "playlist.reorder");
		}
		socket.broadcast.to(socket.channel_id).emit('playlist.reorder', { status:0, content: data});
	});
	
	socket.on('playlist.play_item', function(data){
		// Add DB-Query!
		socket.broadcast.to(socket.channel_id).emit('playlist.play_item', { status: 0, content: data });
	});
});

function r_query(statement, socket, callback) {
	sql.query(statement, function(err, rows, fields){
		if(err){
			console.log(err);
			socket.emit("error", { status: 2, content: err });
		} else {
			callback(rows);
		}
	});
}

function e_query(statement, socket, func_name, p) {
	sql.query(statement, function(err, rows, fields){
		if(err){
			console.log(err);
			socket.emit("error", { status: 2, content: err });
		} else {
			if(!p)
				socket.emit(func_name, { status: 0, content: rows });
			else
				socket.broadcast.to(socket.channel_id).emit(func_name, { status: 0, content: rows });
		}
	});
}

function i_query(statement, socket, func_name){
	sql.query(statement, function(err){
		if(err){
			socket.emit("error", { status: 2, content: err });
			console.log(err);
		}
	});
}

function init_online(channel_id){
	var arr = new Array();
	io.sockets.clients(channel_id).forEach(function(socket){
		arr.push({display_name: socket.display_name, login_name: socket.login_name, level: socket.level, user_id: socket.user_id });
	});
	arr.push({display_name:"Blankblade",login_name:"Blankblade"});
	arr.push({display_name:"Little Crow",login_name:"little_crow"});
	arr.push({display_name:"Button Mash",login_name:"buttonMash"});
	arr.push({display_name:"Wolfprint",login_name:"Wolfprint"});
	arr.push({display_name:"Brushwipe",login_name:"Brushwipe"});
	arr.push({display_name:"Rune",login_name:"Rune"});
	arr.push({display_name:"Masky",login_name:"Masky"});
	arr.push({display_name:"Tigerstripe",login_name:"Tigerstripe"});
	arr.push({display_name:"Sunflare",login_name:"Sunflare"});
	arr.push({display_name:"Rira Timeturner",login_name:"rira"});
	return arr;
}