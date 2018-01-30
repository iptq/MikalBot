var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./../common");

var Help = function() { }

Help.helpHook = async(function(evt, args) {
	common.sendMessage("Hi. I'm a bot.", evt.threadID);
});

Help.metadata = {
	"commands": {
		"help": "helpHook"
	}
};

module.exports = Help;