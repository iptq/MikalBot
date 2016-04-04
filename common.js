require("dotenv").load();

var low = require("lowdb");
var storage = require("lowdb/file-sync");
var db = low("database.json", { storage: storage });

exports.db = db;

var login = require("facebook-chat-api");
exports.init = function(callback) {
	login({
		email: process.env.FACEBOOK_EMAIL,
		password: process.env.FACEBOOK_PASSWORD,
		forceLogin: true
	}, function(err, api) {
		if (err) return console.error(err);
		api.setOptions({ listenEvents: true });
		exports.api = api;
		callback();
	});
}