var Bot    = require('ttapi');
var _und = require('./lib/underscore-min');
var conf   = require('./lib/botconfig');
var lists = require('./lib/lists');
var queue = require('./ttQueue');
var wootCache = require('./wootCache');

var myScriptVersion = '1.5';

var COMMANDS = 'woot, dance, theme, rules, queue, songCount, hello, data, good boy, sunglasses';
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
var adminList = { };
var currentVote = 'NONE';
var silence = false;
var djGreetOn = true;
var danceOn = true;
var bootTTDashBots = false;
var autoSnag = false;
var snagCount = 0;

var PM = 1;
var TCP = 2;


var bot = new Bot(conf.AUTH, conf.USERID, conf.DEFAULT_ROOM);
bot.tcpListen(8777, '127.0.0.1');


bot.on('ready',        function (data) {
    bot.roomRegister(conf.WOOT);
    bot.setStatus('available');
});
bot.on('update_votes', function (data) {
    //console.log('Someone has voted',  data);
});
bot.on('registered',   function (data) {
    if(bootTTDashBots) {
        var user = data.user[0];
        console.log("Checking user");
        console.log(user);
        if(isTTDashBot(user)) {
            bot.bootUser(user.userid, "We don't take kindly to TT Dashboard Bots.");
        }
    }
});
bot.on('newsong',      function (data) {
    currentVote = 'NONE';
    snagCount = 0;
    if (djsList.hasOwnProperty(data.room.metadata.current_dj)) {
        djsList[data.room.metadata.current_dj].plays++;
    }
    if(autoSnag) {
        snag();
    }
});
/*Triggered at the end of the song. (Just before the newsong/nosong event)
 *The data returned by this event contains information about the song that has just ended.*/
bot.on('endsong', function (data) {
    var song = data.room.metadata.current_song;
    console.log('\nSong is over', song);
    speakOut(song.djname + " played \"" + song.metadata.song + "\" by " +
        song.metadata.artist + ". \n" + data.room.metadata.upvotes + " :+1: " +
        data.room.metadata.downvotes + " :-1: " + snagCount + " :heart:");
});

bot.on('snagged', function (data) {
    snagCount = snagCount + 1;
});
bot.on('roomChanged',  function (data) {
    console.log(data);
    currentVote = 'NONE';
    adminList = data.room.metadata.moderator_id;
    adminList.push(data.room.metadata.creator.userid);
    console.log(data.room.metadata.creator.userid);
    console.log('Admin List:' + adminList);
    populateDjList(data);

    if(bot.roomId == conf.WOOT) {
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
});
bot.on('add_dj', function (data) {
    if(queueOn) {
        processNewDJ(data.user[0]);
    } else if(djGreetOn) {
        greetNewDJ(data.user[0]);
    }
    addActiveDJ(data.user[0]);
});
bot.on('rem_dj', function(data) {
    if (data.success) {
        removeActiveDJ(data.user[0].userid);
    }
});
bot.on('speak', function (data) {
    // Get the data
    var name = data.name;
    var text = data.text;
    var userid = data.userid;

    if(userid == conf.USERID) {
        return;
    }

    if(text.match(/^\//) || text.match(/^\./)) {
        var values = text.substring(1).split(" ");
        var command = values.shift().toLowerCase();

        switch(command) {
            case('hello'):
            case('hi'):
            case('hey'):
                speakOut('Hey ' + name + '!');
                break;
            //Dancing commands
            case('boogie'):
            case('boxstep'):
            case('breakdance'):
            case('cabbagepatch'):
            case('carlton'):
            case('thecarlton'):
            case('chacha'):
            case('charliebrown'):
            case('charleston'):
            case('dance'):
            case('disco'):
            case('dougie'):
            case('electricslide'):
            case('grind'):
            case('groove'):
            case('handjive'):
            case('headbang'):
            case('hokeypokey'):
            case('hula'):
            case('hustle'):
            case('thehustle'):
            case('jazzhands'):
            case('jig'):
            case('jitterbug'):
            case('jive'):
            case('lindyhop'):
            case('mambo'):
            case('mashedpotato'):
            case('moonwalk'):
            case('mosh'):
            case('pogo'):
            case('poledance'):
            case('polka'):
            case('popandlock'):
            case('popnlock'):
            case('robot'):
            case('rock'):
            case('rockout'):
            case('rock out'):
            case('rocklobster'):
            case('runningman'):
            case('safetydance'):
            case('salsa'):
            case('shimmy'):
            case('shuffle'):
            case('shufflin'):
            case('skank'):
            case('snoopydance'):
            case('snoopy'):
            case('squaredance'):
            case('sway'):
            case('swing'):
            case('tango'):
            case('tapdance'):
            case('truffleshuffle'):
            case('twist'):
            case('vogue'):
            case('waltz'):
            case('watusi'):
            case('wiggle'):
            case('worm'):
            case('theworm'):
            case('ymca'):
                dance();
                break;
            case('kiss'):
                dance("Aw shucks... Thanks " + name + "! :kiss:");
                break;
            case('hug'):
                dance('SQUEEZE!');
                break;
            case('fonz'):
            case('fonzie'):
                dance('Ayyyyeeeee! :thumbsup: :thumbsup:');
                break;
            case('botsnack'):
                dance('OM NOM NOM');
                break;
            case('fozzie'):
            case('fozziebear'):
                speakOut('Waka Waka Waka');
                break;
            case('frown'):
                if(isAuthorized(userid)) {
                    if(currentVote == 'down') {
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
            case('rules'):
                if(bot.roomId == conf.WOOT) {
                    speakOut(WOOT_RULES_1);
                    setTimeout(function() {
                        speakOut(WOOT_RULES_2)
                    }, 250);
                    setTimeout(function() {
                        speakOut(WOOT_RULES_3)
                    }, 500);
                    setTimeout(function() {
                        speakOut(WOOT_RULES_4)
                    }, 750);
										setTimeout(function() {
                        speakOut(WOOT_RULES_5)
                    }, 1000);
										setTimeout(function() {
                        speakOut(WOOT_RULES_6)
                    }, 1250);
										setTimeout(function() {
                        speakOut(WOOT_RULES_7)
                    }, 1500);
                }
                break;
            case('commands'):
                listCommands(userid);
                break;
            case('songcount'):
            case('sc'):
                printSongCount();
                break;
            case('clearsc'):
            case('scclear'):
                if(isAuthorized(userid)) {
                    resetSongCount();
                    speakOut('Song count reset for all DJs');
                }
                break;
            case('setsc'):
            case('scset'):
            case('setsoundcount'):
                if(isAuthorized(userid)) {
                    console.log(values);
                    if(values.length > 1) {
                        var value = values.pop();
                        var user = values.join(" ");
                        console.log('user: ' + user);
                        console.log('number: ' + value);
                        setSongCount(user, value);
                    }
                }
                break;
            case('q'):
            case('queue'):
                parseQueueCommand(values,userid,name);
                break;
            case('speak'):
            case('talk'):
                if(isAuthorized(userid)) {
                    silence = false;
                    speakOut('I can talk!');
                }
                break;
            case('silence'):
                if(isAuthorized(userid)) {
                    speakOut('I\'ll be quiet');
                    silence = true;
                } else {
                    speakOut('You can\'t shut me up');
                }
                break;
            case('djgreeton'):
                if(isAuthorized(userid)) {
                    djGreetOn = true;
                    speakOut('DJ Greeting turned on');
                }
                break;
            case('djgreetoff'):
                if(isAuthorized(userid)) {
                    djGreetOn = false;
                    speakOut('DJ Greeting turned off');
                }
                break;
            case('danceon'):
                if(isAuthorized(userid)) {
                    danceOn = true;
                    speakOut('Footloose! Kick off your Sunday shoes!');
                }
                break;
            case('danceoff'):
                if(isAuthorized(userid)) {
                    danceOn = false;
                    speakOut('I\'m never going to dance again. Guilty feet have got no rhythm');
                }
                break;
            case('theme'):
                if(values.length > 0) {
                    parseThemeCommand(values.join(' '), userid);
                } else {
                    sayTheme(userid);
                }
                break;
            case('snag'):
                if(userid == conf.OWNER) {
                    snag();
                }
                break;
            case('godj'):
                if(isAuthorized(userid)) {
                    bot.addDj();
                } else {
                    speakOut('Nah, I\'m good just chillin\', laid back, sippin\' on gin and juice');
                }
                break;
            case('stopdj'):
            case('stepdown'):
                if(isAuthorized(userid)) {
                    bot.remDj();
                } else {
                    speakOut('You\'ll never stop the music!');
                }
                break;
            case('skip'):
            case('skipsong'):
                if(isAuthorized(userid)) {
                    bot.skip();
                }
                break;
            case('data'):
                speakOut('Yes Captain Picard?');
                break;
            case('sunglasses'):
                putOnSunglasses();
                break;
            case('good'):
                if(values.length == 1) {
                    if(values[0] == 'boy' || values[0] == 'girl') {
                        speakOut("Woof!");
                    }
                }
                break;
            case('version'):
                speakOut("OiteBot. Created by BruceOite. Currently running version " + myScriptVersion);
                break;
						case('woot'):
                parseWootCommand(values);
                break;
						case('fact'):
							sayFact();
							break;
						case('boc'):
							sayBoc();
							break;

        }

    } else if(text == ':dancers:') {
        dance();
    }
});

bot.on('pmmed', function (data) {
    console.log('\nIncoming personal message:', data);
    if(isAuthorized(data.senderid)) {
        adminCommands(data.text, PM, data.senderid);
    } else {
        bot.pm("Thanks for sharing!", data.senderid);
    }
});

bot.on('tcpMessage', function (socket, msg) {
    console.log('TCP message received',msg);
    adminCommands(msg, TCP, conf.OWNER);
});

function adminCommands(msg, msgMethod, senderId) {
    var values = msg.split(' ');
    var command = values.shift();
    switch (command) {
        case 'silence':
            silence=true;
            respond('Bot silenced.', msgMethod, senderId);
            break;
        case 'speak':
            silence=false;
            respond('Bot will now speak', msgMethod, senderId);
            break;
        case 'dance':
            bot.vote('up');
            break;
        case 'room':
            if(values.length > 0) {
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
        case('setsc'):
        case('scset'):
        case('setsoundcount'):
            console.log(values);
            if(values.length > 1) {
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
    if(queue.isUserNextInQueue(name)) {
        greetNewDJ(user);
        queue.removeUser(name);
    } else {
        warnUser(name);
    }
}

function warnUser(name) {
    speakOut(name + ' please step down. We currently have a queue. If you would like to be added, type /q add.');
}

function parseWootCommand(values) {
    console.log('Parsing Woot command');
    if(values.length > 0) {
        var site = values.shift().toLowerCase();
        speakOut(wootCache.getWootInfo(site));
    } else {
        speakOut(wootCache.getWootInfo('woot'));
    }
}

function parseThemeCommand(text, userid) {
    if(isAuthorized(userid)) {
        if(text == 'none') {
            THEME = 'No current theme, sir.';
        } else {
            THEME = text;
            bot.speak(THEME + ' set as the new theme.');
        }
    }

}


function sayTheme(userid) {
    if(isAuthorized(userid)) {
        bot.speak(THEME);
    } else {
        speakOut(THEME);
    }
}

function parseQueueCommand(values, userid, name) {
    console.log('Parsing Queue command');
    if(values.length > 0) {
        console.log('Switching Queue command');
        var command = values.shift().toLowerCase();
        switch(command) {
            case ('add'):
                if(queueOn) {
                    if(values.length > 0) {
                        if(isAuthorized(userid)) {
                            var userName = values.join(' ');
                            queue.addUser(userName);
                            speakOut(userName + ' has been added to the queue.');
                        }
                    } else {
                        if(addUserToQueue(name, userid)) {
                            speakOut(name + ' has been added to the queue.');
                        }
                    }
                }
                break;
            case ('remove'):
                if(queueOn) {
                    if(values.length > 0) {
                        if(isAuthorized(userid)) {
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
                if(isAuthorized(userid)) {
                    if(!queueOn) {
                        turnQueueOn();
                    } else {
                        speakOut('Queue is already on, sir');
                    }
                }
                break;
            case ('stop'):
                if(isAuthorized(userid)) {
                    if(queueOn) {
                        turnQueueOff();
                    } else {
                        speakOut('Queue is already off, sir');
                    }
                }
                break;
            case ('clear'):
                if(isAuthorized(userid)) {
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
        setTimeout(function() {
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
    queueOn=true;
		bot.speak('The queue is now open. If you would like to join, type "/queue add"');
}

function turnQueueOff() {
    queueOn=false;
		bot.speak('The queue is now closed. Anyone can jump up on the decks.');
}

function sayQueue(userid) {
    if(isAuthorized(userid)) {
        bot.speak(queue.listQueue());
    } else {
        speakOut(queue.listQueue());
    }
}

function addUserToQueue(name, userid) {
    if(isCurrentlyDj(userid)) {
        speakOut(name + ' is currently DJing. Not adding to queue.');
        return false;
    } else if(queue.isUserInQueue(name)){
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

function isAuthorized(userId) {
    console.log('Checking User ID:' + userId);
    if(_und.indexOf(adminList, userId) > 0 || userId == conf.OWNER) {
        return true;
    } else {
        return false;
    }
}

function speakOut(msg) {
    if(silence == false) {
        bot.speak(msg);
    }
}

function listCommands(userid) {
    if(isAuthorized(userid)) {
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
    for(var i in djsList) {
        var outPut = djsList[i].name + ' : ' + djsList[i].plays;
        if(silence == false) {
            bot.speak(outPut);
        } else {
            console.log(outPut);
        }
    }
}

function setSongCount(userName, number) {
    console.log(userName);
    for(var i in djsList) {
        console.log(djsList[i].name);
        if(djsList[i].name == userName) {
            djsList[i].plays = number;
        }
    }
}

function resetSongCount() {
    for(var i in djsList) {
        djsList[i].plays = 0;
    }
}

function populateDjList(data) {
    djsList = new Object();
    if(data) {
        var djs = data.room.metadata.djs;
        var users = data.users;
        for(var i in djs) {
            var user = findUser(djs[i], users);
            if(user) {
                addActiveDJ(user);
            }
        }
    }
}

function findUser(djId, users) {
    var targetUser;
    for(var i in users) {
        var user = users[i];
        console.log(user + ':' + user.userid);
        if(djId == user.userid) {
            targetUser = user;
            break;
        }
    }
    return targetUser;
}

function putOnSunglasses() {
    speakOut('( \u2022_\u2022)');
    setTimeout(function() {
        speakOut('( \u2022_\u2022)>\u2310\u25a0-\u25a0')
    }, 1000);
    setTimeout(function() {
        speakOut('(\u2310\u25a0_\u25a0')
    }, 2000);
}

function playlistRandom() {
	bot.playlistAll(function(playlist) {
		console.log("Playlist length: " + playlist.list.length);
		var i = 0;
		var reorder = setInterval(function() {
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
    if(user) {
        return user.name.match(/^ttdashboard_/);
    }
    return false;
}

function randomDanceResponseGenerator() {
    var randomnumber=Math.floor(Math.random()*101);
    if(randomnumber > 90) {
        return "Rocking out with my dongle out.";
    } else if(randomnumber > 85) {
        return "/me gets her groove on";
    } else if(randomnumber > 80) {
        return "/me starts doing the Dougie";
    } else if(randomnumber > 75) {
        return "/me raises her hands and goes WOOOOOOOO!!!";
    } else if(randomnumber > 70) {
        return "Skanking my little heart out";
    } else if(randomnumber > 65) {
        return "/me pirouettes";
    } else if(randomnumber > 60) {
        return "I love this song!";
    } else if(randomnumber > 55) {
        return "Tappa Tappa Tappa";
    } else if(randomnumber > 50) {
        return "Tappa Tappa Tappa";
    } else if(randomnumber > 45) {
        return "Shaking my moneymaker";
    } else if(randomnumber > 40) {
        return "Shaking my moneymaker";
    } else if(randomnumber > 35) {
        return "MOSH PIT!";
    } else if(randomnumber > 30) {
        return "MOSH PIT!";
    } else if(randomnumber > 25) {
        return "I would love to dance with you!";
    } else if(randomnumber > 20) {
        return "I would love to dance with you!";
    } else if(randomnumber > 15) {
        return "You gonna get served";
    } else if(randomnumber > 10) {
        return "You gonna get served";
    } else if(randomnumber > 5) {
        return "You gonna get served";
    } else {
        return "Doin the Charleston";
    }
}

function dance(message) {
    if(danceOn) {
        if(currentVote == 'up') {
            if(message) {
                speakOut(message);
            } else {
                speakOut('Already shaking my booty sir.');
            }

        } else if(currentVote == 'down') {
            speakOut('I already expressed my disappoint with this song. I shall not dance');
        } else {
            bot.vote('up');
            if(message) {
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
	var rand = Math.floor(Math.random()*10000);
	return array[rand % array.length];
}

function randomBoc() {
	return randomizer(lists.boc) + ', ' + randomizer(lists.boc) + ', ' + randomizer(lists.boc);
}

function snag() {
    bot.snag();
    bot.roomInfo(true, function(data) {
        var newSong = data.room.metadata.current_song._id;
        var newSongName = songName = data.room.metadata.current_song.metadata.song;
        bot.playlistAdd(newSong);
        speakOut('Added '+ newSongName +' to playlist.');
    });
}

function setAvatar(avatar) {
    var avatarID;
    switch(avatar) {
        case('asian girl'):
        case('1'):
            avatarID = 1;
            break;
        case('green girl'):
        case('2'):
            avatarID = 2;
            break;
        case('red girl'):
        case('3'):
            avatarID = 3;
            break;
        case('ginger girl'):
        case('4'):
            avatarID = 4;
            break;
        case('brown boy'):
        case('5'):
            avatarID = 5;
            break;
        case('brown girl'):
        case('6'):
            avatarID = 6;
            break;
        case('boy'):
        case('7'):
            avatarID = 7;
            break;
        case('ginger boy'):
        case('8'):
            avatarID = 8;
            break;
        case('tan bear'):
        case('9'):
            avatarID = 9;
            break;
        case('pin bear'):
        case('10'):
            avatarID = 10;
            break;
        case('green bear'):
        case('11'):
            avatarID = 11;
            break;
        case('bug bear'):
        case('12'):
            avatarID = 12;
            break;
        case('teal bear'):
        case('13'):
            avatarID = 13;
            break;
        case('purple bear'):
        case('14'):
            avatarID = 14;
            break;
        case('gold bear'):
        case('15'):
            avatarID = 15;
            break;
        case('goth bear'):
        case('16'):
            avatarID = 16;
            break;
        case('blue bear'):
        case('17'):
            avatarID = 17;
            break;
        case('blue cat'):
        case('18'):
            avatarID = 18;
            break;
        case('green cat'):
        case('19'):
            avatarID = 19;
            break;
        case('blond hero'):
        case('blond superhero'):
        case('blond cape'):
        case('20'):
            avatarID = 20;
            break;
        case('pink hero'):
        case('pink cape'):
        case('pink superhero'):
        case('21'):
            avatarID = 21;
            break;
        case('devil'):
        case('22'):
            avatarID = 22;
            break;
        case('gorilla'):
        case('23'):
            avatarID = 23;
            break;
        case('black boy'):
        case('34'):
            avatarID = 34;
            break;
        case('fez monkey'):
        case('boy monkey'):
        case('36'):
            avatarID = 36;
            break;
        case('girl monkey'):
        case('pink monkey'):
        case('37'):
            avatarID = 37;
            break;
        case('pink cat'):
        case('121'):
            avatarID = 121;
            break;
        case('scottish spaceman'):
        case('27'):
            avatarID = 27;
            break;
        case('brown eyed spaceman'):
        case('28'):
            avatarID = 28;
            break;
        case('fat spaceman'):
        case('goggles spaceman'):
        case('29'):
            avatarID = 29;
            break;
        case('brown hair spaceman'):
        case('30'):
            avatarID = 30;
            break;
        case('black spaceman'):
        case('31'):
            avatarID = 31;
            break;
        case('black hair spaceman'):
        case('32'):
            avatarID = 32;
            break;
        case('spaceman'):
        case('blue eyed spaceman'):
        case('33'):
            avatarID = 33;
            break;
        default:
            avatar = parseInt(avatar,10);
            if(!isNaN(avatar)) {
                avatarID = avatar;
            }
    }
    if(avatarID) {
        bot.setAvatar(avatarID);
    }
}

function checkDead() {
    var now=new Date();
    if (now - bot._lastHeartbeat > 5 * 60000) {
        console.log('Heartbeat Expired - killing bot for reconnect');
        process.exit(1);
    }
}

setInterval(checkDead, 10000);