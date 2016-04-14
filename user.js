var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./common");
var moment = require("moment");
var promisify = require("deferred").promisify;

var User = function() { }

User.prototype.constructor = User;

User.get_user = async(function(uid) {
	var info = common.db("users").find({ uid: uid }) || { };
	if (info && moment().isBefore(moment(info["expires"], "X"))) {
		return info;
	} else {
		info_2 = await(User.get_user_info(uid))[uid];
		info["uid"] = uid;
		info["expires"] = ~~(moment().add(8, "hours").format("X"));
		info["name_lower"] = info["name"].toLowerCase();
		info["firstName_lower"] = info["firstName"].toLowerCase();
		common.db("users").remove({ uid: uid });
		common.db("users").push(info);
		return info;
	}
});

User.force_update = function(uid) {
	try {
		var expiry = common.db("users").find({ uid: uid }).expires;
		common.db("users").chain()
			.find({ uid: uid })
			.assign({ expires: expiry * 10 })
			.value();
	} catch (e) { }
};

User.get_user_info = async(function(uid) {
	var get_user_info = promisify(common.api.getUserInfo);
	var dfd = get_user_info(uid);
	return dfd;
});

User.get_user_by = async(function(search) {
	return common.db("users").find(search);
});

module.exports = User;