var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./common");
var Thread = require("./thread");

var modules = [];

common.init(function() {
	common.api.listen(async(function(err, evt) {
		try {
			switch (evt.type) {
				case "message":
					var info = await(Thread.get_thread(evt.threadID));
					break;
				default: break;
			}
		} catch (e) {
			console.error(e);
		}
	}));
});