var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./../common");

var BrainPower = function() { }

BrainPower.onMessageReceived = function(evt) {
	if (evt.body.toLowerCase().indexOf("adrenaline is pumpin") >= 0) {
		common.api.sendMessage("GENERATOR", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("generator") >= 0) {
		common.api.sendMessage("AUTOMATIC LOVER", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("automatic lover") >= 0) {
		common.api.sendMessage("ATOMIC", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("atomic") >= 0) {
		common.api.sendMessage("OVERDRIVE", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("overdrive") >= 0) {
		common.api.sendMessage("BLOCKBUSTER", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("blockbuster") >= 0) {
		common.api.sendMessage("BRAIN POWER", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("call me a leader") >= 0) {
		common.api.sendMessage("COCAINE", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("cocaine") >= 0) {
		common.api.sendMessage("DON'T YOU TRY IT", evt.threadID);
	} else if (evt.body.toLowerCase().split("'").join("").indexOf("dont you try it") >= 0) {
		common.api.sendMessage("INNOVATOR", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("innovator") >= 0) {
		common.api.sendMessage("KILLA MACHINE", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("killa machine") >= 0) {
		common.api.sendMessage("THERE'S NO FATE", evt.threadID);
	} else if (evt.body.toLowerCase().split("'").join("").indexOf("theres no fate") >= 0) {
		common.api.sendMessage("TAKE CONTROL", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("take control") >= 0) {
		common.api.sendMessage("BRAIN POWER", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("brain power") >= 0) {
		common.api.sendMessage("LET THE BASS KICK", evt.threadID);
	} else if (evt.body.toLowerCase().indexOf("let the bass kick") >= 0) {
		common.api.sendMessage("O-oooooooooo AAAAE-A-A-I-A-U-\nJO-oooooooooooo AAE-O-A-A-U-U-A-\nE-eee-ee-eee AAAAE-A-E-I-E-A-\nJO-ooo-oo-oo-oo EEEEO-A-AAA-AAAA", evt.threadID);
	}
};

BrainPower.metadata = {
	"events": {
		"onMessageReceived": "onMessageReceived",
	}
};

module.exports = BrainPower;