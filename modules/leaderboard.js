var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./../common");
var User = require("./../user");
var Thread = require("./../thread");

var Leaderboard = function() { }

var experience_to_level = function(xp) {
	var multiplier = 10;
	return Math.floor((Math.sqrt(4*multiplier*(2*xp+multiplier))+2*multiplier)/(4*multiplier));
};

var percent_to_next_level = function(xp) {
	var currentLevel = experience_to_level(xp);
	var prevLevel_xp = 20 * currentLevel * (currentLevel - 1);
	var progress = xp - prevLevel_xp;
	var total = 20 * currentLevel * (currentLevel + 1) - prevLevel_xp;
	return progress * 1.0 / total;
};

Leaderboard.get_leaderboard = function(tid) {
	var entries = common.db("stats").filter({ tid: tid });
	entries.sort(function(a, b) { return b.experience - a.experience });
	return entries;
};

Leaderboard.get_rank = function(uid, tid) {
	var scores = Leaderboard.get_leaderboard(tid);
	var entry = common.db("stats").find({ uid: uid, tid: tid });
	return scores.indexOf(entry) + 1;
};

Leaderboard.not_in_leaderboard = async(function(tid) {
	var thread = await(Thread.get_thread(tid));
	var users = thread["participantIDs"];
	var leaderboard = Leaderboard.get_leaderboard(tid);
	var in_leaderboard = [];
	for(var i=0; i<leaderboard.length; i++) {
		in_leaderboard.push(leaderboard[i]["uid"]);
	}
	var missing = [];
	for(var i=0; i<users.length; i++) {
		if (in_leaderboard.indexOf(users[i]) < 0) {
			missing.push(await(User.get_user(users[i]))["name"]);
		}
	}
	return missing;
});

Leaderboard.onMessageReceived = function(evt) {
	var entry = common.db("stats").find({ uid: evt.senderID, tid: evt.threadID });
	if (entry) {
		common.db("stats").chain()
			.find({ uid: evt.senderID, tid: evt.threadID })
			.assign({ activity: 10 })
			.value();
	} else {
		common.db("stats").push({
			uid: evt.senderID,
			tid: evt.threadID,
			activity: 10,
			experience: 0
		});
	}
};

Leaderboard.everyMinute = async(function(time) {
	var before = [], after = [];
	var threads = common.db("threads").filter({});
	for (var i=0; i<threads.length; i++) {
		var users = common.db("stats").filter({ tid: threads[i]["tid"] }).sort(function(a, b) {
			return a["experience"] - b["experience"];
		});
		var Q = [];
		for(var j=0; j<users.length; j++) {
			before.push({ uid: users[j]["uid"], tid: threads[i]["tid"], better_than: Q.slice(0) });
			Q.push(users[j]["uid"]);
		}
	}
	before = before.sort(function(a, b) { return (a["uid"] != b["uid"]) ? a["uid"] - b["uid"] : a["tid"] - b["tid"]; });
	common.db("stats").filter({}).forEach(function(obj) {
		var experience = obj["experience"] + 0.5 * obj["activity"];
		if (experience_to_level(experience) > experience_to_level(obj["experience"])) {
			var user_info = await(User.get_user(obj["uid"]));
			common.sendMessage(user_info["firstName"] + " ranked up to level " + experience_to_level(experience) + "!", obj["tid"]);
		}
		common.db("stats").chain()
			.find({ uid: obj["uid"], tid: obj["tid"] })
			.assign({ activity: (obj["activity"] == 0) ? 0 : obj["activity"] - 1, experience: experience })
			.value();
	});
	for (var i=0; i<threads.length; i++) {
		var users = common.db("stats").filter({ tid: threads[i]["tid"] }).sort(function(a, b) {
			return a["experience"] - b["experience"];
		});
		var Q = [];
		for(var j=0; j<users.length; j++) {
			after.push({ uid: users[j]["uid"], tid: threads[i]["tid"], better_than: Q.slice(0) });
			Q.push(users[j]["uid"]);
		}
	}
	after = after.sort(function(a, b) { return (a["uid"] != b["uid"]) ? a["uid"] - b["uid"] : a["tid"] - b["tid"]; });
	var messages = {};
	for(var i=0; i<before.length; i++) {
		if (after[i]["better_than"].length > before[i]["better_than"].length) {
			var beat = [];
			for(var j=0; j<after[i]["better_than"].length; j++) {
				if (before[i]["better_than"].indexOf(after[i]["better_than"][j]) < 0) {
					beat.push(await(User.get_user(after[i]["better_than"][j]))["name"]);
				}
			}
			if (!(before[i]["tid"] in messages)) messages[before[i]["tid"]] = [];
			messages[before[i]["tid"]].push(await(User.get_user(before[i]["uid"]))["name"] + " beat " + beat.join(", ") + "!");
		}
	}
	for(var thread in messages) {
		common.sendMessage(messages[thread].join("\n"), thread);
	}
});

Leaderboard.levelHook = async(function(evt, args) {
	console.log("args: " + args);
	var search = evt.senderID;
	if (args.length > 1) {
		var user_info = await(User.get_user_by({ firstName_lower: args[1].toLowerCase() }));
		if (!user_info) user_info = await(User.get_user_by({ name_lower: args[1].toLowerCase() }));
		if (user_info) search = user_info["uid"];
	}
	var entry = common.db("stats").find({ uid: search, tid: evt.threadID }) || { activity: 10, experience: 0 };
	var user_info = await(User.get_user(search));
	var experience = ~~(entry["experience"] * 100) / 100;
	var rank = Leaderboard.get_rank(search, evt.threadID);
	var percent = ~~(percent_to_next_level(experience) * 10000) / 100;
	if (evt.senderID == search) {
		common.sendMessage(user_info["firstName"] + ": You're rank #" + rank + " at level " + experience_to_level(experience) + " (" + experience + "xp, " + percent + "%)", evt.threadID);
	} else {
		common.sendMessage(user_info["firstName"] + " is rank #" + rank + " at level " + experience_to_level(experience) + " (" + experience + "xp, " + percent + "%)", evt.threadID);
	}
});

Leaderboard.rankHook = async(function(evt, args) {
	try {
		if (args.length < 2) throw "";
		var num = parseInt(args[1]);
		var leaderboard = Leaderboard.get_leaderboard(evt.threadID);
		if (num <= 0) {
			return common.sendMessage("Let's keep the ranks positive, thanks.", evt.threadID);
		} else if (num > leaderboard.length) {
			return common.sendMessage("There aren't that many positions!", evt.threadID);
		}
		var entry = leaderboard[num - 1];
		var user = await(User.get_user(entry["uid"]));
		return common.sendMessage(user["name"] + " is in rank #" + num + " with " + (~~(entry["experience"] * 100) / 100) + "xp.", evt.threadID);
	} catch (e) {
		console.log(e);
		common.sendMessage("Failed to find position.", evt.threadID);
	}
});

Leaderboard.leaderboardHook = async(function(evt, args) {
	var leaderboard = Leaderboard.get_leaderboard(evt.threadID);
	var people = [];
	for(var i=0; i<leaderboard.length; i++) {
		var entry = leaderboard[i];
		var user = await(User.get_user(entry["uid"]));
		people.push("#" + (i + 1) + ": " + user["name"] + " (" + (~~(entry["experience"] * 100) / 100) + "xp" + (i < leaderboard.length - 1 ? ", +" + (~~((entry["experience"] - leaderboard[i + 1]["experience"]) * 100) / 100) + "xp" : "") + ")");
	}
	var message = people.join("\n") + "\n";
	message += "Not in leaderboard: " + await(Leaderboard.not_in_leaderboard(evt.threadID)).join(", ");
	common.sendMessage(message, evt.threadID);
});

Leaderboard.metadata = {
	"events": {
		"onMessageReceived": "onMessageReceived",
		"everyMinute": "everyMinute"
	},
	"commands": {
		"level": "levelHook",
		"rank": "rankHook",
		"leaderboard": "leaderboardHook"
	}
};

module.exports = Leaderboard;