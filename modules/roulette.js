var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./../common");
var moment = require("moment");
var User = require("./../user");

var Roulette = function() { }

Roulette.rouletteHook = async(function(evt, args) {
	var senderName = await(User.get_user(evt.senderID))["name"];
	var game_data = common.db("roulette").find({ "tid": evt.threadID });
	var found = game_data !== undefined;
	if (!found) game_data = { "tid": evt.threadID, "rounds": 6, "wins": {}, "deaths": {} };
	var chance = (game_data["rounds"] > 0) ? 1 - (1 / game_data["rounds"]) : 1;
	var dead = Math.random() > chance;
	var update = { "rounds": game_data["rounds"] - 1, "wins": game_data["wins"], "deaths": game_data["deaths"] };
	if (dead) {
		update["rounds"] = 6;
		if (!(evt.threadID in game_data["deaths"])) {
			update["deaths"][evt.threadID] = 1;
		} else {
			update["deaths"][evt.threadID] = game_data["deaths"][evt.threadID] + 1;
		}
		common.api.sendMessage(senderName + ": Bam! You're dead! (death count: " + update["deaths"][evt.threadID] + ")", evt.threadID, function() {
			setTimeout(function() {
				var game_data2 = common.db("roulette").find({ "tid": evt.threadID });
				common.api.addUserToGroup(evt.senderID, evt.threadID);
			}, 60000);
			common.api.removeUserFromGroup(evt.senderID, evt.threadID);
		});
	} else {
		if (update["rounds"] == 1) {
			update["rounds"] = 6;
			if (!(evt.threadID in game_data["wins"])) {
				update["wins"][evt.threadID] = 1;
			} else {
				update["wins"][evt.threadID] = game_data["wins"][evt.threadID] + 1;
			}
			common.api.sendMessage(senderName + ": You win! (win count: " + update["wins"][evt.threadID] + ")", evt.threadID);
		} else {
			common.api.sendMessage(senderName + ": Blank. There's " + update["rounds"] + " round" + (update["rounds"] == 1 ? "" : "s") + " left.", evt.threadID);
		}
	}
	if (found) {
		common.db("roulette")
			.chain()
			.find({ "tid": evt.threadID })
			.assign(update)
			.value();
	} else {
		for(var key in update) {
			game_data[key] = update[key];
		}
		common.db("roulette").push(game_data);
	}
});

Roulette.metadata = {
	"commands": {
		"roulette": "rouletteHook"
	}
};

module.exports = Roulette;