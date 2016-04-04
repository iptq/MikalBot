var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./../common");
var User = require("./../user");

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

Leaderboard.onMessageReceived = function(evt) {
	var entry = common.db("stats").find({ uid: evt.senderID, tid: evt.threadID })
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
	common.db("stats").filter({}).forEach(function(obj) {
		var experience = obj["experience"] + 0.5 * obj["activity"];
		if (experience_to_level(experience) > experience_to_level(obj["experience"])) {
			var user_info = await(User.get_user(obj["uid"]));
			common.api.sendMessage(user_info["firstName"] + " ranked up to level " + experience_to_level(experience) + "!", obj["tid"]);
		}
		common.db("stats").chain()
			.find({ uid: obj["uid"], tid: obj["tid"] })
			.assign({ activity: (obj["activity"] == 0) ? 0 : obj["activity"] - 1, experience: experience })
			.value();
	});
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
	var percent = ~~(percent_to_next_level(experience) * 10000) / 100;
	if (evt.senderID == search) {
		common.api.sendMessage(user_info["firstName"] + ": You're level " + experience_to_level(experience) + " (" + experience + "xp, " + percent + "%)", evt.threadID);
	} else {
		common.api.sendMessage(user_info["firstName"] + " is level " + experience_to_level(experience) + " (" + experience + "xp, " + percent + "%)", evt.threadID);
	}
});

Leaderboard.metadata = {
	"events": {
		"onMessageReceived": "onMessageReceived",
		"everyMinute": "everyMinute"
	},
	"commands": {
		"level": "levelHook"
	}
};

module.exports = Leaderboard;