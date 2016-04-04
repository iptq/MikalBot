var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./common");
var moment = require("moment");
var promisify = require("deferred").promisify;

var Thread = function() { };

Thread.prototype.constructor = Thread;

Thread.get_thread = async(function(tid) {
	var info = common.db("threads").find({ tid: tid });
	if (info && moment().isBefore(info["expires"])) {
		return info;
	} else {
		info = await(Thread.get_thread_info(tid));
		info["tid"] = tid;
		info["expires"] = ~~(moment().add(8, "hours").format("X"));
		common.db("threads").remove({ tid: tid });
		common.db("threads").push(info);
		return info;
	}
});

Thread.force_update = function(tid) {
	try {
		var expiry = common.db("threads").find({ tid: tid }).expires;
		common.db("threads").chain()
			.find({ tid: tid })
			.assign({ expires: expiry * 10 })
			.value();
	} catch (e) { }
};

Thread.get_thread_info = function(tid) {
	var get_thread_info = promisify(common.api.getThreadInfo);
	var dfd = get_thread_info(tid);
	return dfd;
};

module.exports = Thread;