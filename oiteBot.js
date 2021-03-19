#!/usr/bin/env node
var Bot = require('ttapi');
var conf = require('./lib/botconfig');
var lists = require('./lib/lists');
var commandLists = require('./lib/commands');
var queue = require('./ttQueue');
var mehCache = require('./mehCache')
var db = require('./db');

var myScriptVersion = '2.0.21';

var COMMANDS = 'meh, dance, theme, rules, queue, songCount, hello, data, good girl, sunglasses, fact, irk';
var ADMINCMDS = 'frown, speak, silence, djgreeton, djgreetoff, danceon, danceoff, theme (newTheme), snag, goDJ, stopDJ, skip';
var THEME = 'No current theme, sir.';
var WOOT_RULES_1 = '1. Awesome often.';
var WOOT_RULES_2 = '2. To dj, join the queue by typing /q add in chat.';
var WOOT_RULES_3 = '3. Play 3 songs and step down, unless there is no line (use .sc to see your songcount).';
var WOOT_RULES_4 = '4. If you are away from your keyboard (afk) on your turn you will be skipped and sent to the end of the line (i.e. You will be removed from the stage and queue).';
var WOOT_RULES_5 = '5. Awesome your fellow djs while on stage. Absolutely no laming while on the decks.';
var WOOT_RULES_6 = '6. No afk while onstage. Being afk for over 10 minutes can get you pulled down.';
var WOOT_RULES_7 = '7. Keep songs near 7 minutes max.';

var queueOn = false;

var djsList = new Object();
var adminList = {};
var currentVote = 'NONE';
var silence = false;
var djGreetOn = true;
var danceOn = true;
var bootTTDashBots = false;
var autoSnag = false;
var snagCount = 0;
var users = {};
var banned = {};

var Artist = db.Artist;
var Song = db.Song;
var User = db.User;
var Play = db.Play;
var DBConfig = db.DBConfig;

var currentSong = {
	artist: null,
	album: null,
	song: null,
	songid: null,
	djname: null,
	djid: null,
	up: 0,
	down: 0,
	listeners: 0,
	started: 0,
	mods: [],
	snags: 0
};

var PM = 1;
var TCP = 2;


var bot = new Bot(conf.AUTH, conf.USERID, conf.DEFAULT_ROOM);
bot.tcpListen(8777, '127.0.0.1');


bot.on('ready', function (data) {
	bot.roomRegister(conf.DEFAULT_ROOM);
	bot.setStatus('available');
});
bot.on('update_votes', function (data) {
	currentSong.up = data.room.metadata.upvotes;
	currentSong.down = data.room.metadata.downvotes;
	currentSong.listeners = data.room.metadata.listeners;

	var now = new Date();
	var vl = data.room.metadata.votelog;
	for (var u = 0; u < vl.length; u++) {
		if (users.hasOwnProperty(vl[u][0])) {
			console.log(now + " VoteUp: " + users[vl[u][0]].name);
		}
	}

});

bot.on('registered', function (data) {
	var us = data.user[0];
	us.warns = [];
	us.lastActive = new Date();
	users[us.userid] = us;
	console.log("Join: " + us.name);
});

bot.on('deregistered', function (data) {
	delete users[data.user[0].userid];
	console.log("Part: " + data.user[0].name);
});

bot.on('new_moderator', function (data) {
	if (adminList.indexOf(data.userid) < 0) {
		adminList.push(data.userid);
	}
});

bot.on('rem_moderator', function (data) {
	var modIndex = adminList.indexOf(data.userid);
	if (modIndex >= 0) {
		adminList.splice(data.userid, 1);
	}
});

bot.on('newsong', function (data) {
	currentVote = 'NONE';
	snagCount = 0;
	if (djsList.hasOwnProperty(data.room.metadata.current_dj)) {
		djsList[data.room.metadata.current_dj].plays++;
	}
	if (autoSnag) {
		snag();
	}
	newSong(data);
});
/*Triggered at the end of the song. (Just before the newsong/nosong event)
 *The data returned by this event contains information about the song that has just ended.*/
bot.on('endsong', function (data) {
	var song = data.room.metadata.current_song;
	console.log('\nSong is over', song);
	speakOut(song.djname + " played \"" + song.metadata.song + "\" by " +
		song.metadata.artist + ". \n" + data.room.metadata.upvotes + " :+1: " +
		data.room.metadata.downvotes + " :-1: " + snagCount + " :heart:");
	endSong();
});

bot.on('snagged', function (data) {
	snagCount = snagCount + 1;
	currentSong.snags = snagCount + 1;
});
bot.on('roomChanged', function (data) {
	console.log(data);
	currentVote = 'NONE';
	adminList = data.room.metadata.moderator_id;
	adminList.push(data.room.metadata.creator.userid);
	console.log("Admin list: " + adminList);
	populateDjList(data);

	if (bot.roomId == conf.WOOT) {
		danceOn = true;
		djGreetOn = true;
		silence = false;
		bootTTDashBots = false;
		turnQueueOn();
	} else {
		danceOn = false;
		djGreetOn = false;
		silence = true;
		bootTTDashBots = false;
	}
	newSong(data);

	// Repopulate user list
	users = {}
	for (var u = 0; u < data.users.length; u++) {
		us = data.users[u];
		us.lastActive = new Date();
		us.isDj = false;
		us.warns = [];
		users[us.userid] = us;
	}
});
bot.on('add_dj', function (data) {
	if (queueOn) {
		processNewDJ(data.user[0]);
	} else if (djGreetOn) {
		greetNewDJ(data.user[0]);
	}
	addActiveDJ(data.user[0]);
});
bot.on('rem_dj', function (data) {
	if (data.success) {
		removeActiveDJ(data.user[0].userid);
	}
});
bot.on('speak', function (data) {
	// Get the data
	var name = data.name;
	var text = data.text;
	var userid = data.userid;

	if (userid == conf.USERID) {
		return;
	}

	if (text == ':dancers:') {
		dance();
		return;
	}

	if (!text.match(/^\//) && !text.match(/^\./)) {
		return;
	}

	var values = text.substring(1).split(" ");
	var command = values.shift().toLowerCase();
	console.log("Command: " + command);

	if (commandLists.greetings.includes(command)) {
		speakOut('Hey ' + name + '!');
		return;
	}

	if (commandLists.dances.includes(command)) {
		handleDanceCommand(command, name);
		return;
	}

	switch (command) {
		case ('fozzie'):
		case ('fozziebear'):
			speakOut('Waka Waka Waka');
			break;
		case ('frown'):
			if (isAdmin(userid)) {
				if (currentVote == 'down') {
					speakOut('I have already expressed my displeasure for the current musical selection');
				} else {
					bot.vote('down');
					speakOut('What is this? I don\'t even...');
					currentVote = 'down';
				}
			} else {
				speakOut('I will not help spread your hate.');
			}
			break;
		//Stats commands
		case ('mystats'):
			doUserStats(data);
			break;
		case ('mybest'):
			doUserBest(data);
			break;
		case ('bestplay'):
			doRecord();
			break;
		case ('topartist'):
			doTopArtist();
			break;
		case ('rules'):
			if (bot.roomId == conf.WOOT) {
				speakOut(WOOT_RULES_1);
				setTimeout(function () {
					speakOut(WOOT_RULES_2)
				}, 250);
				setTimeout(function () {
					speakOut(WOOT_RULES_3)
				}, 500);
				setTimeout(function () {
					speakOut(WOOT_RULES_4)
				}, 750);
				setTimeout(function () {
					speakOut(WOOT_RULES_5)
				}, 1000);
				setTimeout(function () {
					speakOut(WOOT_RULES_6)
				}, 1250);
				setTimeout(function () {
					speakOut(WOOT_RULES_7)
				}, 1500);
			}
			break;
		case ('commands'):
			listCommands(userid);
			break;
		case ('songcount'):
		case ('sc'):
			printSongCount();
			break;
		case ('clearsc'):
		case ('scclear'):
			if (isAdmin(userid)) {
				resetSongCount();
				speakOut('Song count reset for all DJs');
			}
			break;
		case ('setsc'):
		case ('scset'):
		case ('setsoundcount'):
			if (isAdmin(userid)) {
				console.log(values);
				if (values.length > 1) {
					var value = values.pop();
					var user = values.join(" ");
					console.log('user: ' + user);
					console.log('number: ' + value);
					setSongCount(user, value);
				}
			}
			break;
		case ('q'):
		case ('queue'):
			parseQueueCommand(values, userid, name);
			break;
		case ('speak'):
		case ('talk'):
			if (isAdmin(userid)) {
				silence = false;
				speakOut('I can talk!');
			}
			break;
		case ('silence'):
			if (isAdmin(userid)) {
				speakOut('I\'ll be quiet');
				silence = true;
			} else {
				speakOut('You can\'t shut me up');
			}
			break;
		case ('djgreeton'):
			if (isAdmin(userid)) {
				djGreetOn = true;
				speakOut('DJ Greeting turned on');
			}
			break;
		case ('djgreetoff'):
			if (isAdmin(userid)) {
				djGreetOn = false;
				speakOut('DJ Greeting turned off');
			}
			break;
		case ('danceon'):
			if (isAdmin(userid)) {
				danceOn = true;
				speakOut('Footloose! Kick off your Sunday shoes!');
			}
			break;
		case ('danceoff'):
			if (isAdmin(userid)) {
				danceOn = false;
				speakOut('I\'m never going to dance again. Guilty feet have got no rhythm');
			}
			break;
		case ('theme'):
			if (values.length > 0) {
				parseThemeCommand(values.join(' '), userid);
			} else {
				sayTheme(userid);
			}
			break;
		case ('snag'):
			if (userid == conf.OWNER) {
				snag();
			} else {
				speakOut('You aint the boss of me!');
			}

			break;
		case ('godj'):
			if (isAdmin(userid) || isRegular(userid)) {
				bot.addDj();
			} else {
				speakOut('Nah, I\'m good just chillin\', laid back, sippin\' on gin and juice');
			}
			break;
		case ('stopdj'):
		case ('stepdown'):
			if (isAdmin(userid) || isRegular(userid)) {
				bot.remDj();
			} else {
				speakOut('You\'ll never stop the music!');
			}
			break;
		case ('skip'):
		case ('skipsong'):
			if (isAdmin(userid) || isRegular(userid)) {
				bot.skip();
			}
			break;
		case ('data'):
			speakOut('Yes Captain Picard?');
			break;
		case ('sunglasses'):
			putOnSunglasses();
			break;
		case ('good'):
			if (values.length == 1) {
				if (values[0] == 'boy' || values[0] == 'girl') {
					speakOut("Woof!");
				}
			}
			break;
		case ('version'):
			speakOut("OiteBot. Created by BruceOite. Currently running version " + myScriptVersion);
			break;
		case ('meh'):
			parseMehCommand();
			break;
		case ('woot'):
			parseWootCommand(values);
			break;
		case ('fact'):
			sayFact();
			break;
		case ('irk'):
		case ('boc'):
			sayBoc();
			break;

	}


});

bot.on('pmmed', function (data) {
	console.log('\nIncoming personal message:', data);
	if (isAdmin(data.senderid)) {
		adminCommands(data.text, PM, data.senderid);
	} else {
		bot.pm("Thanks for sharing!", data.senderid);
	}
});

bot.on('tcpMessage', function (socket, msg) {
	console.log('TCP message received', msg);
	adminCommands(msg, TCP, conf.OWNER);
});

function adminCommands(msg, msgMethod, senderId) {
	var values = msg.split(' ');
	var command = values.shift();
	switch (command) {
		case 'silence':
			silence = true;
			respond('Bot silenced.', msgMethod, senderId);
			break;
		case 'speak':
			silence = false;
			respond('Bot will now speak', msgMethod, senderId);
			break;
		case 'dance':
			bot.vote('up');
			break;
		case 'room':
			if (values.length > 0) {
				switchRoom(values[0]);
			}
			break;
		case 'say':
			bot.speak(values.join(' '));
			break;
		case 'mods':
			console.log(adminList);
			break;
		case 'avatar':
			setAvatar(values.join(' '));
			break;
		case 'os':
			bot.modifyLaptop(values.join(' '));
			break;
		case 'songcount':
			printSongCount();
			break;
		case 'status':
			console.log('Silent mode: ' + silence);
			console.log('Queue On: ' + queueOn);
			console.log('DJ Greet: ' + djGreetOn);
			console.log('Can dance: ' + danceOn);
			console.log('Current vote: ' + currentVote);
			console.log('Kick TT Dash: ' + bootTTDashBots);
			console.log('Current theme: ' + THEME);
			console.log('AutoSnag: ' + autoSnag);
			break;
		case 'theme':
			THEME = values.join(' ');
			break;
		case 'kicktton':
			bootTTDashBots = true;
			break;
		case 'kickttoff':
			bootTTDashBots = false;
			break;
		case 'godj':
		case 'djup':
			bot.addDj();
			break;
		case 'stopdj':
		case 'djdown':
			bot.remDj();
			break;
		case 'snagon':
			autoSnag = true;
			bot.speak('Autosnag on');
			break;
		case 'snagoff':
			autoSnag = false;
			break;
		case ('setsc'):
		case ('scset'):
		case ('setsoundcount'):
			console.log(values);
			if (values.length > 1) {
				var value = values.pop();
				var user = values.join(" ");
				console.log('user: ' + user);
				console.log('number: ' + value);
				setSongCount(user, value);
			}

			break;
		default:
			console.log('I got something, don\'t know what ' + msg);
	}
}

function switchRoom(roomName) {
	switch (roomName) {
		case 'woot':
			console.log('Moving to the woot room');
			bot.roomDeregister();
			bot.roomRegister(conf.WOOT);
			break;
		case 'test':
			console.log('Moving to the test room');
			bot.roomDeregister();
			bot.roomRegister(conf.TEST);
			break;
		default:
			console.log('Trying to use entry as roomId: ' + roomName);
			bot.roomDeregister();
			bot.roomRegister(roomName);
			break;
	}

}

function respond(msg, method, receiverid) {
	bot.pm(msg, receiverid);
}

function processNewDJ(user) {
	var name = user.name;
	if (queue.isUserNextInQueue(name)) {
		greetNewDJ(user);
		queue.removeUser(name);
	} else {
		warnUser(name);
	}
}

function warnUser(name) {
	speakOut(name + ' please step down. We currently have a queue. If you would like to be added, type /q add.');
}

function handleDanceCommand(command, name) {
	var message = '';
	switch (command) {
		case ('hug'):
			message = 'SQUEEZE!';
			break;
		case ('kiss'):
			message = 'Aw shucks... Thanks ' + name + '! :kiss:';
			break;
		case ('fonz'):
		case ('fonzie'):
			message = 'Ayyyyeeeee! :thumbsup: :thumbsup:';
			break;
		case ('botsnack'):
			message = 'OM NOM NOM';
			break;
		default:
			message = '';
			break;
	}
	dance(message);
}

function parseWootCommand(values) {
	speakOut('We actually prefer Meh.com these days');
	parseMehCommand();
}

function parseMehCommand() {
	console.log('Parsing Meh command');
	speakOut(mehCache.getMehInfo());
}

function parseThemeCommand(text, userid) {
	if (isAdmin(userid)) {
		if (text == 'none') {
			THEME = 'No current theme, sir.';
		} else {
			THEME = text;
			bot.speak(THEME + ' set as the new theme.');
		}
	}

}


function sayTheme(userid) {
	if (isAdmin(userid)) {
		bot.speak(THEME);
	} else {
		speakOut(THEME);
	}
}

function parseQueueCommand(values, userid, name) {
	console.log('Parsing Queue command');
	if (values.length > 0) {
		console.log('Switching Queue command');
		var command = values.shift().toLowerCase();
		switch (command) {
			case ('add'):
				if (queueOn) {
					if (values.length > 0) {
						if (isAdmin(userid)) {
							var userName = values.join(' ');
							queue.addUser(userName);
							speakOut(userName + ' has been added to the queue.');
						}
					} else {
						if (addUserToQueue(name, userid)) {
							speakOut(name + ' has been added to the queue.');
						}
					}
				}
				break;
			case ('remove'):
				if (queueOn) {
					if (values.length > 0) {
						if (isAdmin(userid)) {
							var userName = values.join(' ');
							queue.removeUser(userName);
							speakOut(userName + ' has been removed from the queue.');
						}
					} else {
						queue.removeUser(name);
						speakOut(name + ' has been removed from the queue.');
					}
				}
				break;
			case ('start'):
				if (isAdmin(userid)) {
					if (!queueOn) {
						turnQueueOn();
					} else {
						speakOut('Queue is already on, sir');
					}
				}
				break;
			case ('stop'):
				if (isAdmin(userid)) {
					if (queueOn) {
						turnQueueOff();
					} else {
						speakOut('Queue is already off, sir');
					}
				}
				break;
			case ('clear'):
				if (isAdmin(userid)) {
					queue.clearQueue();
				}
				break;
			case ('show'):
			case ('list'):
				displayQueue();
				break;
			default:
				listQueueCommands();

		}
	} else {
		displayQueue();
		setTimeout(function () {
			listQueueCommands()
		}, 250);
	}
}

function listQueueCommands() {
	speakOut("add, remove, list. Admins can start, stop and clear.");
}

function displayQueue() {
	console.log('Display queue');
	if (queueOn) {
		speakOut("Queue: " + queue.listQueue());
	} else {
		speakOut('Queue is closed. Anyone can jump up on the decks.');
	}
}

function turnQueueOn() {
	queueOn = true;
	bot.speak('The queue is now open. If you would like to join, type "/queue add"');
}

function turnQueueOff() {
	queueOn = false;
	bot.speak('The queue is now closed. Anyone can jump up on the decks.');
}

function sayQueue(userid) {
	if (isAdmin(userid)) {
		bot.speak(queue.listQueue());
	} else {
		speakOut(queue.listQueue());
	}
}

function addUserToQueue(name, userid) {
	if (isCurrentlyDj(userid)) {
		speakOut(name + ' is currently DJing. Not adding to queue.');
		return false;
	} else if (queue.isUserInQueue(name)) {
		speakOut(name + ' is already in the queue.');
		return false;
	} else {
		queue.addUser(name);
		return true;
	}
}

function isCurrentlyDj(userid) {
	console.log(djsList[userid]);
	return djsList[userid];
}

function isAdmin(userId) {
	if (adminList.includes(userId) || userId == conf.OWNER) {
		return true;
	} else {
		return false;
	}
}

function isRegular(userId) {
	if (conf.REGULARS.includes(userId)) {
		return true;
	} else {
		return false;
	}
}

function speakOut(msg) {
	if (silence == false) {
		bot.speak(msg);
	}
}

function listCommands(userid) {
	if (isAdmin(userid)) {
		bot.speak(COMMANDS);
		bot.speak(ADMINCMDS)
	} else {
		speakOut(COMMANDS);
	}
}

function greetNewDJ(user) {
	speakOut('Hello ' + user.name + '! The theme is currently: ' + THEME + '. Please stay active while DJing and enjoy!');
}

function addActiveDJ(user) {
	if (user) {
		djsList[user.userid] = {
			lastActive: new Date(),
			plays: 0,
			removed: null,
			name: user.name
		};
	}
}

function removeActiveDJ(userid) {
	console.log('remove dj: ' + userid);
	if (djsList && userid && djsList.hasOwnProperty(userid)) {
		djsList[userid].removed = new Date();
		delete djsList[userid];
	}
}

function printSongCount() {
	for (var i in djsList) {
		var outPut = djsList[i].name + ' : ' + djsList[i].plays;
		if (silence == false) {
			bot.speak(outPut);
		} else {
			console.log(outPut);
		}
	}
}

function setSongCount(userName, number) {
	console.log(userName);
	for (var i in djsList) {
		console.log(djsList[i].name);
		if (djsList[i].name == userName) {
			djsList[i].plays = number;
		}
	}
}

function resetSongCount() {
	for (var i in djsList) {
		djsList[i].plays = 0;
	}
}

function populateDjList(data) {
	djsList = new Object();
	if (data) {
		var djs = data.room.metadata.djs;
		var users = data.users;
		for (var i in djs) {
			var user = findUser(djs[i], users);
			if (user) {
				addActiveDJ(user);
			}
		}
	}
}

function findUser(djId, users) {
	var targetUser;
	for (var i in users) {
		var user = users[i];
		console.log(user + ':' + user.userid);
		if (djId == user.userid) {
			targetUser = user;
			break;
		}
	}
	return targetUser;
}

function putOnSunglasses() {
	speakOut('( \u2022_\u2022)');
	setTimeout(function () {
		speakOut('( \u2022_\u2022)>\u2310\u25a0-\u25a0')
	}, 1000);
	setTimeout(function () {
		speakOut('(\u2310\u25a0_\u25a0')
	}, 2000);
}

function playlistRandom() {
	bot.playlistAll(function (playlist) {
		console.log("Playlist length: " + playlist.list.length);
		var i = 0;
		var reorder = setInterval(function () {
			if (i <= playlist.list.length) {
				var nextId = Math.ceil(Math.random() * playlist.list.length);
				bot.playlistReorder(i, nextId);
				console.log("Song " + i + " changed.");
				i++;
			} else {
				clearInterval(reorder);
				console.log("Reorder Ended");
				bot.speak("Reorder completed.");
			}
		}, 1000);
	});
}

function isTTDashBot(user) {
	if (user) {
		return user.name.match(/^ttdashboard_/);
	}
	return false;
}

function isBanned(userid) {
	var isbanned = false;
	for (var d = 0; d < banned.length; d++) {
		if (banned[d] == userid) {
			isbanned = true;
			break;
		}
	}
	return isbanned;
}

function randomDanceResponseGenerator() {
	var randomnumber = Math.floor(Math.random() * 101);
	if (randomnumber > 90) {
		return "Rocking out with my dongle out.";
	} else if (randomnumber > 85) {
		return "/me gets her groove on";
	} else if (randomnumber > 80) {
		return "/me starts doing the Dougie";
	} else if (randomnumber > 75) {
		return "/me raises her hands and goes WOOOOOOOO!!!";
	} else if (randomnumber > 70) {
		return "Skanking my little heart out";
	} else if (randomnumber > 65) {
		return "/me pirouettes";
	} else if (randomnumber > 60) {
		return "I love this song!";
	} else if (randomnumber > 55) {
		return "Tappa Tappa Tappa";
	} else if (randomnumber > 50) {
		return "Tappa Tappa Tappa";
	} else if (randomnumber > 45) {
		return "Shaking my moneymaker";
	} else if (randomnumber > 40) {
		return "Shaking my moneymaker";
	} else if (randomnumber > 35) {
		return "MOSH PIT!";
	} else if (randomnumber > 30) {
		return "MOSH PIT!";
	} else if (randomnumber > 25) {
		return "I would love to dance with you!";
	} else if (randomnumber > 20) {
		return "I would love to dance with you!";
	} else if (randomnumber > 15) {
		return "You gonna get served";
	} else if (randomnumber > 10) {
		return "You gonna get served";
	} else if (randomnumber > 5) {
		return "You gonna get served";
	} else {
		return "Doin the Charleston";
	}
}

function dance(message) {
	if (danceOn) {
		if (currentVote == 'up') {
			if (message) {
				speakOut(message);
			} else {
				speakOut('Already shaking my booty sir.');
			}

		} else if (currentVote == 'down') {
			speakOut('I already expressed my disappoint with this song. I shall not dance');
		} else {
			bot.vote('up');
			if (message) {
				speakOut(message);
			} else {
				speakOut(randomDanceResponseGenerator());
			}
			currentVote = 'up';

		}
	}
}

function sayFact() {
	speakOut(randomizer(lists.facts));
}

function sayBoc() {
	speakOut(':moneybag::poop:: ' + randomBoc());
}

function randomizer(array) {
	var rand = Math.floor(Math.random() * 10000);
	return array[rand % array.length];
}

function randomBoc() {
	return randomizer(lists.boc) + ', ' + randomizer(lists.boc) + ', ' + randomizer(lists.boc);
}

function snag() {
	if (!currentSong) {
		speakOut('No song playing.');
		return;
	}
	console.log('Snagging!');
	bot.playlistAdd(currentSong.songid);
	bot.snag();
	speakOut('Added ' + currentSong.song + ' to playlist.');
}

function setAvatar(avatar) {
	var avatarID;
	switch (avatar) {
		case ('asian girl'):
		case ('1'):
			avatarID = 1;
			break;
		case ('green girl'):
		case ('2'):
			avatarID = 2;
			break;
		case ('red girl'):
		case ('3'):
			avatarID = 3;
			break;
		case ('ginger girl'):
		case ('4'):
			avatarID = 4;
			break;
		case ('brown boy'):
		case ('5'):
			avatarID = 5;
			break;
		case ('brown girl'):
		case ('6'):
			avatarID = 6;
			break;
		case ('boy'):
		case ('7'):
			avatarID = 7;
			break;
		case ('ginger boy'):
		case ('8'):
			avatarID = 8;
			break;
		case ('tan bear'):
		case ('9'):
			avatarID = 9;
			break;
		case ('pin bear'):
		case ('10'):
			avatarID = 10;
			break;
		case ('green bear'):
		case ('11'):
			avatarID = 11;
			break;
		case ('bug bear'):
		case ('12'):
			avatarID = 12;
			break;
		case ('teal bear'):
		case ('13'):
			avatarID = 13;
			break;
		case ('purple bear'):
		case ('14'):
			avatarID = 14;
			break;
		case ('gold bear'):
		case ('15'):
			avatarID = 15;
			break;
		case ('goth bear'):
		case ('16'):
			avatarID = 16;
			break;
		case ('blue bear'):
		case ('17'):
			avatarID = 17;
			break;
		case ('blue cat'):
		case ('18'):
			avatarID = 18;
			break;
		case ('green cat'):
		case ('19'):
			avatarID = 19;
			break;
		case ('blond hero'):
		case ('blond superhero'):
		case ('blond cape'):
		case ('20'):
			avatarID = 20;
			break;
		case ('pink hero'):
		case ('pink cape'):
		case ('pink superhero'):
		case ('21'):
			avatarID = 21;
			break;
		case ('devil'):
		case ('22'):
			avatarID = 22;
			break;
		case ('gorilla'):
		case ('23'):
			avatarID = 23;
			break;
		case ('black boy'):
		case ('34'):
			avatarID = 34;
			break;
		case ('fez monkey'):
		case ('boy monkey'):
		case ('36'):
			avatarID = 36;
			break;
		case ('girl monkey'):
		case ('pink monkey'):
		case ('37'):
			avatarID = 37;
			break;
		case ('pink cat'):
		case ('121'):
			avatarID = 121;
			break;
		case ('scottish spaceman'):
		case ('27'):
			avatarID = 27;
			break;
		case ('brown eyed spaceman'):
		case ('28'):
			avatarID = 28;
			break;
		case ('fat spaceman'):
		case ('goggles spaceman'):
		case ('29'):
			avatarID = 29;
			break;
		case ('brown hair spaceman'):
		case ('30'):
			avatarID = 30;
			break;
		case ('black spaceman'):
		case ('31'):
			avatarID = 31;
			break;
		case ('black hair spaceman'):
		case ('32'):
			avatarID = 32;
			break;
		case ('spaceman'):
		case ('blue eyed spaceman'):
		case ('33'):
			avatarID = 33;
			break;
		default:
			avatar = parseInt(avatar, 10);
			if (!isNaN(avatar)) {
				avatarID = avatar;
			}
	}
	if (avatarID) {
		bot.setAvatar(avatarID);
	}
}

function newSong(data) {
	meta = data.room.metadata;
	var dj = meta.current_dj;
	if (!meta.current_song) return;
	currentSong.artist = meta.current_song.metadata.artist;
	currentSong.album = meta.current_song.metadata.album;
	currentSong.song = meta.current_song.metadata.song;
	currentSong.djname = meta.current_song.djname;
	currentSong.songid = meta.current_song._id;
	currentSong.djid = meta.current_song.djid;
	currentSong.up = meta.upvotes;
	currentSong.down = meta.downvotes;
	currentSong.listeners = meta.listeners;
	currentSong.started = meta.current_song.starttime;
	currentSong.mods = meta.moderator_id;
	currentSong.mods.push(meta.userid);
	currentSong.snags = 0;
	mods = currentSong.mods;
}

function endSong() {
	log("Doing End Song data stuff");
	log("current song artist: " + currentSong.artist);
	var up = currentSong.up;
	var down = currentSong.down;
	var snag = currentSong.snags;
	var song = currentSong.song;
	var listeners = currentSong.listeners;
	var songid = currentSong.songid;
	var artist = currentSong.artist;
	var artistid = null;
	var djid = currentSong.djid;
	var djname = currentSong.djname;
	var album = currentSong.album;
	Artist.foc(artist, function (err, docs) {
		log(err);
		a = docs;
		Song.foc(songid, song, a, function (err, docs) {
			log(err);
			s = docs;
			User.foc(djid, djname, function (err, docs) {
				log(err);
				u = docs;
				var thisplay = null;
				Play.foc(null, function (err, docs) {
					log(err);
					p = docs;
					p.dj = djid;
					p.listens = listeners;
					p.ups = up;
					p.downs = down;
					p.snags = snag;
					p.song = s;
					p.score = up - down;
					thisplay = p;
					p.save(function (err) {
						log(err);
					});
				});
				u.ups = u.ups ? u.ups + up : up;
				u.downs = u.downs ? u.downs + down : down;
				u.snags = u.snags ? u.snags + snag : snag;
				u.plays++;
				var score = up - down;
				if (score > u.record) {
					u.record = score;
					u.recordplay = thisplay;
				}
				u.save(function (err) {
					log(err)
				});
			});

			s.ups = s.ups ? s.ups + up : up;
			s.downs = s.downs ? s.downs + down : down;
			s.snags = s.snags ? s.snags + snag : snag;
			s.album = album;
			s.plays++;
			s.save(function (err) {
				log(err);
			});
		});
		a.ups = a.ups ? a.ups + up : up;
		a.downs = a.downs ? a.downs + down : down;
		a.snags = a.snags ? a.snags + snag : snag;
		a.plays++;
		a.lowername = artist.toLowerCase();
		a.save(function (err) {
			log(err);
		});
		artistid = a._id;
	});
	var now = new Date();
	for (var u in users) {
		User.foc(users[u].userid, users[u].name, function (err, data) {
			log(err);
			us = data;
			uid = us._id;
			if (users.hasOwnProperty(uid)) {
				us.lastActive = users[uid].lastActive;
				us.lowername = users[uid].name.toLowerCase();
				us.lastSeen = now;
				if (users[uid].isDj == true) {
					us.lastDj = now;
				}
			}
			us.save(function (err) {
				log(err);
			});
		});
	}
}

function doUserStats(source) {
	u = User.findById(source.userid, function (err, doc) {
		if (doc) {
			speakOut(source.name + ' - You have ' + doc.plays + ' plays ' +
				' totaling ' + doc.ups + ' ups, ' + doc.downs + ' downs, and ' +
				doc.snags + ' snags.');
		} else {
			speakOut('I don\'t know you ' + source.name);
		}
	});
}

function doUserBest(source) {
	Play.where('dj', source.userid).sort('-score played')
		.limit(1).select('_id').exec(function (err, doc) {
			log(err);
			if (doc) {
				p = doc[0];
				if (!p) {
					speakOut(source.name + ' - I have no record of you');
					return;
				}
				Play.getPlay(p._id, function (err, doc) {
					log(err);
					p = doc;
					Song.getSong(p.song._id, function (err, doc) {
						log(err);
						s = doc;
						speakOut(p.dj.name + ' - your best play: '
							+ p.song.name + ' by ' + s.artist.name
							+ ' with a combined score of ' + p.score);
					});
				});
			} else {
				speakOut(source + ' - I have no record of you');
			}
		});
}


function doTopArtist() {
	Artist.where('ups').gt(0).sort('-ups downs').limit(1)
		.exec(function (err, doc) {
			log(err);
			a = doc[0];
			speakOut('Top Artist: ' + a.name + ' with ' + a.ups +
				' up votes, ' + a.downs + ' down votes, ' + a.snags + ' snags ' +
				' and ' + a.plays + ' plays');
		});
	return;

}

function doRecord() {
	Play.where('score').gt(0).sort('-score played')
		.limit(1).select('_id').exec(function (err, doc) {
			log(err);
			p = doc[0];
			Play.getPlay(p._id, function (err, doc) {
				log(err);
				p = doc;
				Song.getSong(p.song._id, function (err, doc) {
					log(err);
					s = doc;
					speakOut('Record Play: ' + p.dj.name + ' played '
						+ p.song.name + ' by ' + s.artist.name
						+ ' with a combined score of ' + p.score);
				});
			});
		});
}

function log(data) {
	if (data) {
		console.log("ERR: " + data);
	}
}

function checkDead() {
	var now = new Date();
	if (now - bot._lastHeartbeat > 5 * 60000) {
		console.log('Heartbeat Expired - killing bot for reconnect');
		process.exit(1);
	}
}

setInterval(checkDead, 10000);
