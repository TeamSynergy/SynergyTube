﻿var mysql = require('mysql');
var sql = null;
var config = null;
exports.connected = false;

// on Error automatically tries to reconnect to the mysql-server on Connection-Loss
var onError = function(err){
	if(err){
		console.log(err);
		if(err.code === "PROTOCOL_CONNECTION_LOST")
			exports.connected = false;
	}
	if(!exports.connected){
		var re = setInterval(function(){
			exports.connect(config, function(c){
				if(c)
					clearInterval(re);
				else
					console.log("re-connect attempt failed");
			});
		}, 5000);
	}
};

exports.connect = function(db_config, callback){
	config = db_config;
	sql = mysql.createConnection(config);
	sql.connect(function(err){
		if(err) {
			console.log(err);
			exports.connected = false;
		} else {
			exports.connected = true;
			sql.on("error", onError);
		}
		if(typeof callback === "function")
			callback(exports.connected);
	});
};

exports.getInformation = function(callback){
	var get = function(statement, callback){process.stdout.write(statement);process.stdin.once('data', function(data){callback(data.toString().trim());});};
	var r = {};
	get("\t- user: ", function(user){
	get("\t- password: ", function(password){
	get("\t- database: ", function(database){
		r.user = user;
		r.password = password;
		r.database = database;
		callback(r);
	});});});
};

exports.createStructure = function(db_config, callback){
	sql = mysql.createConnection({ user: db_config.user, password: db_config.password });
	console.log("Connecting to db...");
	sql.connect(function(err){if(err)exports.onQueryError(err);else{
	console.log("Successfully connected");
	var c = function(statement,fn){
		return sql.query(statement,function(err){
			if(err){
				exports.onQueryError(err);
				return false;
			} else {
				return fn();
			}
		});
	};
	// as of v0.2
	c("CREATE DATABASE IF NOT EXISTS `" + db_config.database + "` CHARACTER SET utf8 COLLATE utf8_general_ci", function(){
		console.log("created database");
	c("USE `" + db_config.database + "`", function(){
	
 	c("CREATE TABLE IF NOT EXISTS relAdmins (channel_id int(11) NOT NULL, user_id int(11) NOT NULL, PRIMARY KEY(channel_id,user_id))",function(){
		console.log("created table relAdmins");
	
	c("CREATE TABLE IF NOT EXISTS relFavourites (channel_id int(11) NOT NULL, user_id int(11) NOT NULL, PRIMARY KEY(channel_id,user_id))",function(){
		console.log("created table relFavourites");
    
	c("CREATE TABLE IF NOT EXISTS `relSkips` ( `media_id` int(10) NOT NULL, `user_id` int(11) NOT NULL, UNIQUE KEY `user_id` (`user_id`), UNIQUE KEY `user_id_2` (`user_id`))",function(){
		console.log("created table relSkips");
	
	c("CREATE TABLE IF NOT EXISTS tblChannels (_id int(11) NOT NULL AUTO_INCREMENT, name varchar(45) NOT NULL, " +
		"cover_id varchar(45) NOT NULL, cover_repeat varchar(10) NOT NULL, cover_pos_x varchar(10) NOT NULL, cover_pos_y varchar(10) NOT NULL, " +
		"custom_url varchar(45) NOT NULL, owner_id int(11) NOT NULL, description varchar(400) NOT NULL, user_limit int(11) NOT NULL, skip_limit_multiplier int(11) NOT NULL, " +
		"PRIMARY KEY(_id), UNIQUE KEY name_UNIQUE (name), UNIQUE KEY custom_url_UNIQUE (custom_url)) DEFAULT CHARSET=utf8",function(){
		console.log("created table tblChannels");
	
	c("CREATE TABLE IF NOT EXISTS tblMedia (_id int(10) unsigned NOT NULL AUTO_INCREMENT, caption varchar(200) NOT NULL, " +
		"url varchar(200) NOT NULL, position int(11) NOT NULL, channel_id int(11) NOT NULL, user_id int(11) NOT NULL, duration int(11) NOT NULL, " +
		"start_time datetime NOT NULL, media_type varchar(15) NOT NULL, PRIMARY KEY(_id)) DEFAULT CHARSET=utf8",function(){
		console.log("created table tblMedia");
	
	c("CREATE TABLE IF NOT EXISTS tblMessages(_id int(10) unsigned NOT NULL AUTO_INCREMENT, timestamp datetime NOT NULL, content varchar(400) NOT NULL, " +
		"user_id int(11) NOT NULL, channel_id int(11) NOT NULL, PRIMARY KEY(_id)) DEFAULT CHARSET=utf8",function(){
		console.log("created table tblMessages");
	
	c("CREATE TABLE IF NOT EXISTS tblTracking(_id int(10) unsigned NOT NULL AUTO_INCREMENT, ip_hash char(64) NOT NULL, channel_id int(11) NOT NULL, " +
		"timestamp datetime NOT NULL, PRIMARY KEY(_id)) DEFAULT CHARSET=utf8",function(){
		console.log("created table tblTracking");
	
	c("CREATE TABLE IF NOT EXISTS tblUser(_id int(11) NOT NULL AUTO_INCREMENT, login_name varchar(45) NOT NULL, display_name varchar(45) NOT NULL, " +
		"email varchar(90) NOT NULL, avatar_id varchar(45) NOT NULL, strategy varchar(10) NOT NULL, hash varchar(200) NOT NULL, session_id char(64) DEFAULT NULL, " +
		"is_valid tinyint(1) NOT NULL, validate_hash char(64) NOT NULL, PRIMARY KEY(_id), UNIQUE KEY login_name_UNIQUE (login_name), UNIQUE KEY email_UNIQUE (email), " +
		"UNIQUE KEY display_name_UNIQUE (display_name)) DEFAULT CHARSET=utf8",function(){
		console.log("created table tblUser");
	callback(0);
  //Aneurysm!
	});});});});});});});});});});}});
};


exports.onQueryError = function(err){
	console.log(err);
};

exports.user = {};
exports.user.session = {};
exports.user.profile = {};
exports.channel = {};
exports.channel.chat = {};
exports.channel.playlist = {};

/* === User-Functions === */

exports.user.findBySessionID = function(session_id, fn){
	sql.query("SELECT * FROM tblUser WHERE session_id = " + sql.escape(session_id), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			if(rows.length > 0)
				return fn(rows[0]);
			else
				return fn(null);
	});
};

exports.user.findByLoginName = function(login_name, fn){
	sql.query("SELECT * FROM tblUser WHERE login_name = " + sql.escape(login_name.toLowerCase()) +" OR email = " + sql.escape(login_name.toLowerCase()) + "", function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			if(rows.length > 0)
				return fn(rows[0]);
			else
				return fn(null);
	});
};

exports.user.exists = function(login_name, email, fn){
	sql.query("SELECT IFNULL(COUNT(*),0) AS '_c' FROM tblUser WHERE login_name = " + sql.escape(login_name) + " OR email = " + sql.escape(email), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			return fn(rows[0]._c > 0);
	});
};

exports.user.create = function(login_name, email, strategy, password_hash, validate_hash, fn){
	sql.query("INSERT INTO tblUser (login_name, display_name, email, strategy, hash, is_valid, validate_hash) VALUES (" + sql.escape(login_name.toLowerCase()) + ", " + sql.escape(login_name) + ", " + sql.escape(email) + ", " + sql.escape(strategy) + ", " + sql.escape(password_hash) + ", 0, " + sql.escape(validate_hash) + ")", function(err){
		if(err)
			exports.onQueryError(err);
		else
			return fn();
	});
};

exports.user.session.destroy = function(login_name, session_id, fn){
	sql.query("UPDATE tblUser SET session_id = '' WHERE login_name = " + sql.escape(login_name.toLowerCase()) + " AND session_id = " + sql.escape(session_id), function(err){
		if(err)
			exports.onQueryError(err);
		else
			if(typeof fn !== "undefined")
				return fn();
	});
};

exports.user.session.create = function(login_name, session_id, fn){
	sql.query("UPDATE tblUser SET session_id = " + sql.escape(session_id) + " WHERE login_name = " + sql.escape(login_name.toLowerCase()), function(err){
		if(err)
			exports.onQueryError(err);
		else
			return fn();
	});
};

exports.user.isFaved = function(channel_id, user_id, fn){
	sql.query("SELECT COUNT(*) AS '_c' FROM relFavourites WHERE channel_id = " + sql.escape(channel_id) + " AND user_id = " + sql.escape(user_id), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			return fn(rows[0]._c === 1);
	});
};

exports.user.favourites = function(user_id, fn){
	sql.query("SELECT channel_id, user_id, name, description FROM relFavourites INNER JOIN tblChannels ON tblChannels._id = relFavourites.channel_id WHERE user_id = " + sql.escape(user_id), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			return fn(rows);
	});
};

exports.user.favChannel = function(user_id, channel_id, fn){
	sql.query("INSERT INTO relFavourites (channel_id, user_id) VALUES (" + sql.escape(channel_id) + ", " + sql.escape(user_id) + ")", function(err){
		if(err)
			exports.onQueryError(err);
		else
			return fn();
	});
};

exports.user.unFavChannel = function(user_id, channel_id, fn){
	sql.query("DELETE FROM relFavourites WHERE channel_id = " + sql.escape(channel_id) + " AND user_id = " + sql.escape(user_id), function(err){
		if(err)
			exports.onQueryError(err);
		else
			return fn();
	});
};

/* === User-Profile Functions === */

exports.user.profile.setPictureID = function(user_id, picture_id, fn){
	sql.query("UPDATE tblUser SET avatar_id = " + sql.escape(picture_id) + " WHERE _id = " + sql.escape(user_id), function(err){
		if(err)
			exports.onQueryError();
		else
			return fn();
	});
};

exports.user.profile.setDisplayName = function(user_id, display_name, fn){
	sql.query("UPDATE tblUser SET display_name = " + sql.escape(display_name) + " WHERE _id = " + sql.escape(user_id), function(err){
		if(err)
			exports.onQueryError();
		fn(err);
	});
};

exports.user.profile.setPassword = function(user_id, password, fn){
	sql.query("UPDATE tblUser SET hash = " + sql.escape(password) + " WHERE _id = " + sql.escape(user_id), function(err){
		if(err)
			exports.onQueryError();
		fn(err);
	});
};

exports.user.profile.setEmail = function(user_id, email, fn){
	sql.query("UPDATE tblUser SET email = " + sql.escape(email) + " WHERE _id = " + sql.escape(user_id), function(err){
		if(err)
			exports.onQueryError();
		fn(err);
	});
};

exports.user.profile.deletion = function(user_id, fn){
	sql.query("DELETE FROM tblUser WHERE _id = " + sql.escape(user_id), function(err){
		if(err)
			exports.onQueryError();
		fn(err);
	});
};


/* === Channel-Functions === */

exports.channel.findByChannelID = function(channel_id, fn){
	sql.query("SELECT * FROM tblChannels WHERE _id = " + sql.escape(channel_id), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			if(rows.length > 0)
				return fn(rows[0]);
			else
				return fn();
	});
};

exports.channel.isOwner = function(channel_id, user_id, fn){
	sql.query("SELECT IFNULL(COUNT(*),0) AS '_c' FROM tblChannels WHERE owner_id = " + sql.escape(user_id) + " AND _id = " + sql.escape(channel_id), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			return fn(rows[0]._c === 1);
	});
};

exports.channel.isAdmin = function(channel_id, user_id, fn){
	sql.query("SELECT IFNULL(COUNT(*),0) AS '_c' FROM relAdmins WHERE user_id = " + sql.escape(user_id) + " AND channel_id = " + sql.escape(channel_id), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			return fn(rows[0]._c === 1);
	});
};

exports.channel.getUniqueVisits = function(channel_id, fn){
	sql.query("SELECT IFNULL(COUNT(DISTINCT ip_hash),0) AS '_c' FROM tblTracking WHERE channel_id = " + sql.escape(channel_id), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			return fn(rows[0]._c);
	});
};

exports.channel.getFavourites = function(channel_id, fn){
	sql.query("SELECT IFNULL(COUNT(*),0) AS '_c' FROM relFavourites WHERE channel_id = " + sql.escape(channel_id), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			return fn(rows[0]._c);
	});
};

	/* -- Channel.Chat -- */

exports.channel.chat.getLatest = function(channel_id, count, fn){
	sql.query("SELECT timestamp, content, display_name FROM tblMessages INNER JOIN tblUser ON tblUser._id = tblMessages.user_id WHERE channel_id = " + sql.escape(channel_id) + " ORDER BY timestamp DESC LIMIT 0, " + sql.escape(count), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			return fn(rows);
	});
};

exports.channel.chat.getMore = function(channel_id, count, max_messages, last_stamp, fn){
	sql.query("SELECT COUNT(*) AS '_c' FROM tblMessages WHERE channel_id = " + sql.escape(channel_id) + " AND timestamp >= " + sql.escape(last_stamp), function(err, stamps){
		console.log("user_message_display_count: " + stamps[0]._c);
		if(err){
			exports.onQueryError(err);
		} else if(stamps[0]._c  < max_messages){
			var get_count = 0;
			
			if(stamps[0]._c + count < max_messages)
				get_count = count;
			else
				get_count = max_messages - stamps[0]._c;
			
			console.log("has: " + stamps[0]._c + "/max: " + max_messages + "/return: " + get_count + " messages");
			
			sql.query("SELECT timestamp, content, display_name FROM tblMessages INNER JOIN tblUser ON tblUser._id = tblMessages.user_id WHERE channel_id = " + sql.escape(channel_id) + " AND timestamp < " + sql.escape(last_stamp) + " ORDER BY timestamp DESC LIMIT 0, " + sql.escape(get_count), function(err, rows){
				if(err)
					exports.onQueryError(err);
				else
					return fn(rows);
			});
		} else {
			return fn([]);
		}
	});
};

exports.channel.chat.add = function(channel_id, user_id, content, fn){
	sql.query("INSERT INTO tblMessages (channel_id, user_id, content, timestamp) VALUES (" + sql.escape(channel_id) + ", " + sql.escape(user_id) + ", " + sql.escape(content) + ", NOW())", function(err){
		if(err)
			exports.onQueryError(err);
		else
			return fn();
	});
};

	/* -- Channel.Playlist -- */

exports.channel.playlist.getAll = function(channel_id, fn){
	sql.query("SELECT tblMedia._id, position, url, caption, duration, display_name, login_name, media_type FROM tblMedia RIGHT JOIN tblUser ON tblUser._id = tblMedia.user_id WHERE channel_id = " + sql.escape(channel_id) + " ORDER BY position ASC", function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			return fn(rows);
	});
};

//contrived :3
exports.channel.playlist.findCurrent = function(channel_id, fn){
	sql.query("SELECT * FROM tblMedia WHERE channel_id = " + sql.escape(channel_id) + " ORDER BY start_time DESC LIMIT 0,1 ", function(err, rows){
		if(err)
			exports.onQueryError(err);
		else{
			if(rows.length === 0)
				return fn(null);
			else{
				//there might be a clever join way of doing this idk
				sql.query("SELECT IFNULL(COUNT(*),0) as '_c' FROM relSkips WHERE media_id = " + sql.escape(rows[0]._id), function(err, skipCountRow){//fabulous subquery
					if(err)
						exports.onQueryError(err);
					else{
						sql.query("SELECT skip_limit_multiplier as '_m' FROM tblChannels WHERE _id = " + sql.escape(channel_id), function(err, skipMultiRow){
							if(err)
								exports.onQueryError(err);
							else {
								rows[0].skip = { votes: skipCountRow[0]._c, multiplier: skipMultiRow[0]._m };
								return fn(rows[0]);
              }
						});
          }
				});
      }
    }
	});
};

exports.channel.playlist.findByPosition = function(channel_id, position, fn){
	sql.query("SELECT * FROM tblMedia WHERE channel_id = " + sql.escape(channel_id) + " AND position = " + sql.escape(position), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			if(rows.length > 0)
				return fn(rows[0]);
			else
				return fn(null);
	});
};
//A little contrived
exports.channel.playlist.skipVoteCurrent = function(channel_id, user_id, fn){
	exports.channel.playlist.findCurrent(channel_id, function(current_media){
		//this feels clever - each user can at a time only have one skip active - should maybe be per channel, actually? who is using more than one synergytube channel at once though
		sql.query('REPLACE INTO relSkips (user_id,media_id) VALUES (' + sql.escape(user_id) + ', ' + sql.escape(current_media._id) + ')', function(err){
			if(err)
				exports.onQueryError(err);
			else {
				sql.query('SELECT COUNT(*) as "_c" FROM relSkips WHERE media_id = '+sql.escape(current_media._id), function(err, rows){
					if(err)
						exports.onQueryError(err);
					else {
						var _c = rows[0]._c;
						sql.query('SELECT tblChannels.skip_limit_multiplier as "_l" FROM `tblChannels` WHERE tblChannels._id = '+sql.escape(channel_id), function(err, rows){
							if(err)
								exports.onQueryError(err);
							else
								return fn({votes: _c, limit_multiplier: rows[0]._l});
						});
					}
				});
			}
		});
	});
};

exports.channel.playlist.findNext = function(channel_id, fn){
	exports.channel.playlist.findCurrent(channel_id, function(current){
		exports.channel.playlist.findByPosition(channel_id, (current.position + 1), function(next){
			if(next)
				return fn(next);
			else
				exports.channel.playlist.findByPosition(channel_id, 1, function(first){
					return fn(first);
				});
		});
	});
};

exports.channel.playlist.playNext = function(channel_id, fn){
	exports.channel.playlist.findNext(channel_id, function(next){
		console.log("new item is " + next.caption);
		exports.channel.playlist.playItem(next._id);
		if(typeof fn !== "undefined")
			fn();
	});
};

exports.channel.playlist.getHighestPosition = function(channel_id, fn){
	sql.query("SELECT MAX(position) AS '_p' FROM tblMedia WHERE channel_id = " + sql.escape(channel_id), function(err, rows){
		if(err)
			exports.onQueryError(err);
		else
			if(rows[0])
				return fn(rows[0]._p);
			else
				return fn(0);
	});
};

exports.channel.playlist.setItemPositionByID = function(item_id, position, fn){
	sql.query("UPDATE tblMedia SET position = " + sql.escape(position) + " WHERE _id = " + sql.escape(item_id), function(err){
		if(err)
			exports.onQueryError(err);
		else
			if(typeof fn === "function")
				return fn();
	});
};

exports.channel.playlist.playItem = function(item_id, fn){
	sql.query("UPDATE tblMedia SET start_time = NOW() WHERE _id = " + sql.escape(item_id), function(err){
		if(err)
			exports.onQueryError(err);
		else
			if(typeof fn !== "undefined")
				return fn();
	});
};

exports.channel.playlist.append = function(channel_id, user_id, url, position, duration, caption, media_type, fn){
	sql.query("INSERT INTO tblMedia (channel_id, user_id, url, position, duration, caption, media_type) VALUES (" + sql.escape(channel_id) + ", " + sql.escape(user_id) + ", " + sql.escape(url) + ", " + sql.escape(position) + ", " + sql.escape(duration) + ", " + sql.escape(caption) + ", " + sql.escape(media_type) + ")", function(err, result){
		if(err)
			exports.onQueryError(err);
		else
			return fn(result.insertId);
	});
};

exports.channel.playlist.remove = function(item_id, fn){
	sql.query("DELETE FROM tblMedia WHERE _id = " + sql.escape(item_id), function(err){
		if(err)
			exports.onQueryError(err);
		else
			return fn();
	});
};

exports.channel.playlist.count = function(channel_id, fn){
	sql.query("SELECT COUNT(*) AS '_c' FROM tblMedia WHERE channel_id = " + sql.escape(channel_id), function(err, media_count){
		if(err)
			exports.onQueryError(err);
		else
			return fn(media_count[0]._c);
	});
};
