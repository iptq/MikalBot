var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./common");
var config = require("./config");
var moment = require("moment");
var parse = require("shell-quote").parse;
var Thread = require("./thread");
var User = require("./user");

var modules = [];

common.init(function() {
	var intval = setInterval(async(function() {
		var timestamp = ~~(moment().format("X"));
		// everyMinute
		for(var moduleName in common.modules) {
			var module = common.modules[moduleName];
			if ("events" in module["metadata"] && "everyMinute" in module["metadata"]["events"]) {
				await(module[module["metadata"]["events"]["everyMinute"]](timestamp));
			}
		}
	}), 60000);
	require("./modules/leaderboard").everyMinute(0);
	common.api.listen(async(function(err, evt) {
		try {
			switch (evt.type) {
				case "message":
					var user_info = await(User.get_user(evt.senderID));
					var thread_info = await(Thread.get_thread(evt.threadID));
					// onMessageReceived
					for(var moduleName in common.modules) {
						var module = common.modules[moduleName];
						if ("events" in module["metadata"] && "onMessageReceived" in module["metadata"]["events"]) {
							module[module["metadata"]["events"]["onMessageReceived"]](evt);
						}
					}
					// commands
					if (evt.body.startsWith(config.trigger)) {
						var command = evt.body.substring(config.trigger.length).split(" ")[0].toLowerCase();
						var args = parse(evt.body.substring(config.trigger.length));
						for(var cmd in common.commands) {
							if (cmd == command) {
								console.log("cmd: " + cmd + ", msg: " + evt.body);
								await(common.commands[cmd](evt, args));
							}
						}
					}
					break;
				default: break;
			}
		} catch (e) {
			console.error(e);
		}
	}));
});