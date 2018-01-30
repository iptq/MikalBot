var config = require("./config");
var fs = require("fs");
var path = require("path");
var promisify = require("deferred").promisify;

var low = require("lowdb");
var storage = require("lowdb/file-sync");
var db = low("database.json", { storage: storage });

exports.db = db;

var EVENTS = [ "onMessageReceived", "everyMinute" ];
var load_modules = function() {
	var module, modules = {}, commands = {};
	var moduleList = fs.readdirSync("modules").forEach(function(file) {
		if (!file.endsWith(".js")) return false;
		try {
			var module = require("./" + path.join("modules", file));
			if (!("metadata" in module)) throw "No metadata found.";
			var meta = module["metadata"];

			if ("events" in meta) {
				for(var evt in meta["events"]) {
					if (EVENTS.indexOf(evt) < 0) throw "Event '" + evt + "' isn't valid.";
					if (!(meta["events"][evt] in module)) throw "Event '" + meta["events"][evt] + "' not found in module.";
				}
			}
			if ("commands" in meta) {
				for(var command in meta["commands"]) {
					if (!(meta["commands"][command] in module)) throw "Hook '" + meta["commands"][command] + "' not found in module.";
					commands[command] = module[meta["commands"][command]];
				}
			}
		} catch (e) {
			console.error("Module " + file + " not loaded: " + e);
			return false;
		}
		console.log("Loaded module: " + file);
		return modules[file.replace(".js", "")] = module;
	});
	exports.modules = modules;
	exports.commands = commands;
};

var login = require("facebook-chat-api");
exports.init = function(callback) {
	load_modules();
	login({
		email: config.credentials.email,
		password: config.credentials.password,
		forceLogin: true
	}, function(err, api) {
		if (err) return console.error(err);
		api.setOptions({
			listenEvents: true
		});
		exports.api = api;
		exports.sendMessage = function(msg, tID) {
			console.log("[BOT]", msg);
			api.sendMessage(msg, tID);
		};
		callback();
	});
}