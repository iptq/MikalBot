var login = require("facebook-chat-api");
var jsonfile = require("jsonfile");
var fs = require("fs");
var express = require("express");
var low = require("lowdb");
var storage = require("lowdb/file-sync");
var session = require("express-session");
var moment = require("moment");
var async = require("async");
var request = require("request");
var webshot = require("webshot");

var db = low("database.json", { storage: storage });

var app = express();
var domain = "http://mikalbot-failedxyz.c9users.io";

var token = function(length) {
	var length = length || 25;
	var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	var token = "";
	for(var i=0; i<length; i++) {
		var R = Math.floor(Math.random()*chars.length);
		token += chars.substring(R, R+1);
	}
	return token;
};

var secret = token();
try {
	secret = fs.readFileSync(".secret", { encoding: "utf-8" });
} catch (err) {
	fs.writeFileSync(".secret", secret);
}

app.set("view engine", "ejs");
app.use(session({ secret: secret }));
app.use(express.static("public"));

app.get("/", function(req, res) {
	res.render("pages/index", {
		N: Object.keys(activity).length
	});
});
app.get("/about", function(req, res) {
	res.render("pages/about");
});
app.get("/stats/:thread", function(req, res) {
	if (!("thread" in req.params)) {
		return res.redirect("/");
	} else {
		var opt = {
			"leaderboard": getLeaderboard(req.params["thread"])
		};
		if ("images" in req.query && req.query["images"] == "no") {
			opt["images"] = "no";
		} else {
			opt["images"] = "yes";
		}
		res.render("pages/stats", opt);
	}
});

var activity = {};
var roulette = {};

db._.mixin({
	randomize: function(array) {
		return array[~~(Math.random()*array.length)];
	}
});

try {
	fs.statSync("data.json");
	var data = jsonfile.readFileSync("data.json");
	activity = data["activity"];
	roulette = data["roulette"];
	console.log("Reloaded saved data.");
} catch (e) { }

var getUserObject = function(uid) {
	var obj = db("users").find({ "id": uid });
	if (obj) {
		if (obj["expire"] < ~~(moment().format("X"))) db("users").remove({ "id": uid });
		return obj;
	}
	else return null;
}

var getUserData = function(uid, key) {
	var obj = getUserObject(uid);
	if (obj) return obj[key];
	else return null;
};

var getUserDataByName = function(name) {
	var obj = db("users").find({ "name": name });
	if (obj) {
		if (obj["expire"] < ~~(moment().format("X"))) db("users").remove({ "id": obj["id"] });
		return obj;
	}
	else return null;
}

var getUserDataByFirstName = function(firstName) {
	var obj = db("users").find({ "firstName": firstName });
	if (obj) {
		if (obj["expire"] < ~~(moment().format("X"))) db("users").remove({ "id": obj["id"] });
		return obj;
	}
	else return null;
}

var getUserName = function(uid) {
	return getUserData(uid, "name");
};

var cacheUser = function(user) {
	user["expire"] = ~~(moment().add(8, "hours").format("X"));
	db("users").push(user);
};

var getThreadData = function(tid, key) {
	var obj = db("threads").find({ "id": tid });
	if (obj) {
		if (obj["expire"] < ~~(moment().format("X"))) db("threads").remove({ "id": tid });
		return obj["name"];
	}
	else return null;
};

var getThreadName = function(tid) {
	return getThreadData(tid, "name");
};

var cacheThread = function(thread) {
	thread["expire"] = ~~(moment().add(8, "hours").format("X"));
	db("threads").push(thread);
};

var getLevel = function(exp) {
	var multiplier = 10;
	return Math.floor((Math.sqrt(4*multiplier*(2*exp+multiplier))+2*multiplier)/(4*multiplier));
};

var getPercentToNextLevel = function(exp) {
	var currentLevel = getLevel(exp);
	var prevLevel_xp = 20 * currentLevel * (currentLevel - 1);
	var progress = exp - prevLevel_xp;
	var total = 20 * currentLevel * (currentLevel + 1) - prevLevel_xp;
	return progress * 1.0 / total;
};

var getLeaderboard = function(thread) {
	var result = { "tid": thread, };
	result["name"] = getThreadName(thread);
	var threadUsers = activity[thread];
	var users = [];
	for (var uid in threadUsers) {
		var xp = Math.round(100*threadUsers[uid]["experience"])/100;
		var level = getLevel(xp);
		var percent = getPercentToNextLevel(xp) * 100;
		var user = getUserObject(uid);
		if (!user) continue;
		var obj = {
			"name": user["name"],
			"firstName": user["firstName"],
			"xp": xp,
			"level": level,
			"percent": percent,
			"picture": user["picture"]
		};
		users.push(obj);
	}
	users.sort(function(a, b) {
		return b["xp"] - a["xp"];
	});
	result["users"] = users;
	return result;
};


app.listen(8080, function() {
	console.log("Listening...");
	
login({
	email: process.env.FACEBOOK_EMAIL,
	password: process.env.FACEBOOK_PASSWORD,
	forceLogin: true
}, function callback(err, api) {
	if (err) return console.dir(err);
	api.setOptions({
		"listenEvents": true
	});

	var counter = setInterval(function() {
		for(var thread in activity) {
			for(var user in activity[thread]) {
				if (activity[thread][user]["activity"] > 0) activity[thread][user]["activity"] -= 1;
				var gain = activity[thread][user]["activity"] * 0.4;
				var lvl_a = getLevel(activity[thread][user]["experience"]);
				activity[thread][user]["experience"] += gain;
				var lvl_b = getLevel(activity[thread][user]["experience"]);
				if (lvl_b != lvl_a) {
					api.sendMessage("^.^ " + getUserName(user) + " just ranked up to level " + lvl_b + "!", thread);
				}
			}
		}
		for(thread in roulette) {
			var remain = [];
			if ("kicked" in roulette[thread]) {
				for(var i=0; i<roulette[thread]["kicked"].length; i++) {
					user = roulette[thread]["kicked"][i];
					// console.log(user["until"] + " " + ~~(moment().format("X")));
					if (user["until"] < ~~(moment().format("X"))) {
						api.addUserToGroup(user["id"], thread);
					} else {
						remain.push(user);
					}
				}
			}
			roulette[thread]["kicked"] = []; // remain;
		}
		console.log(roulette);
		var savedata = {
			"activity": activity,
			"roulette": roulette,
		};
		jsonfile.writeFileSync("data.json", savedata);
		var now = new Date();
		if (now.getUTCHours() % 2 == 0 && now.getMinutes() == 0) {
			jsonfile.writeFileSync("logs/data_" + moment().format("X") + ".json", savedata);
		}
		console.log("saved!");
	}, 60000);
	
	var interpret = api.listen(function(err2, event) {
		if (err2) return console.dir(err2);
		if (event.type == "message") {
			// console.log(event);
			var sender = {
				"name": event.senderName,
				"id": event.senderID,
			};
			var thread = {
				"name": event.threadName,
				"id": event.threadID
			};
			
			if (getThreadData(thread.id, "name") == null) {
				cacheThread(thread);
			}
			
			async.each(event.participantsInfo, function(participant, callback) {
				if (getUserDataByName(participant.name) == null) {
					request.post("http://findmyfbid.com/", { "form": { "url": participant.profileUrl } }).on("response", function(response) {
						// console.log(participant.name + " " + response.headers["location"]);
						var user = {
							"id": response.headers["location"].split("http://findmyfbid.com/success/")[1],
							"name": participant.name,
							"picture": participant.thumbSrc,
							"firstName": participant.firstName,
							"gender": participant.gender
						};
						cacheUser(user);
						callback();
					});
				} else {
					callback();
					// console.log("Already cached!");
				}
			}, function(err) {
				if (err) return console.dir(err);
				console.log("finished.");
				var timestamp = event.timestamp;
				var message = event.body;
				
				/* if (message.trim().length > 0) {
					var msgObj = {
						"sender": sender.id,
						"thread": thread.id,
						"body": message,
						"timestamp": timestamp
					};
					db("messages").push(msgObj);
				} */
				
				if (!(thread.id in activity)) {
					activity[thread.id] = {};
				}
				if (!(sender.id in activity[thread.id])) {
					activity[thread.id][sender.id] = { "activity": 0, "experience": 0 };
				}
				activity[thread.id][sender.id]["activity"] = 10;
				
				if (event.attachments.length > 0) {
					if (event.attachments[0].type == "sticker") {
						var sticker = event.attachments[0];
						if (db("stickers").find({ "sid": sticker.stickerID })) {
						} else {
							db("stickers").push({ "sid": sticker.stickerID, "pid": sticker.packID });
							api.sendMessage({
								sticker: db("stickers").randomize()["sid"]
							}, thread.id);
						}
					}
				}
				
				var hour = ~~(new Date()).getUTCHours();
				if (sender.id == "100003896281163" && thread.id == "512907945552033" && hour >= 8 && hour < 12) {
					api.sendMessage("GO TO SLEEP MICHELLE", "512907945552033");
				}
				
				if (thread.id == "512907945552033" && message.toLowerCase().indexOf("team") >= 0) {
					api.sendMessage("team?", thread.id);
				}
				
				if (sender.id == "100000466030348" && thread.id == "512907945552033") {
					activity[thread.id][sender.id]["activity"] = 0;
				}
				if (sender.id == "100000919104182" && thread.id == "521751258001669") {
					activity[thread.id][sender.id]["activity"] = 0;
				}
				
				if (message.startsWith("!")) {
					switch(message.substring(1).split(" ")[0].toLowerCase()) {
						case "level":
							var xp = Math.round(100*activity[thread.id][sender.id]["experience"])/100;
							var level = getLevel(xp);
							var percent = Math.round(getPercentToNextLevel(xp) * 10000) / 100;
							api.sendMessage("@" + sender.name + ": You are level " + level + " (" + xp + "xp, " + percent + "%)!", thread.id);
							break;
						case "leaderboard":
						case "stats":
							var url = domain + "/stats/" + thread.id + "?images=yes";
							console.log("capturing " + url + "...");
							// api.sendMessage("current leaderboard: " + domain + "/stats/" + thread.id, thread.id);
							webshot(url, "tmp/" + thread.id + ".png", {
								shotSize: { "height": "all" },
								// takeShotOnCallback: true
							}, function(err3) {
								if (err3) return console.dir(err3);
								console.log("captured");
								var obj = {
									"attachment": fs.createReadStream("tmp/" + thread.id + ".png")
								}
								api.sendMessage(obj, thread.id);
							});
							break;
						case "roll":
							var max = 100;
							try {
								var args = message.split("!roll ")[1].split(" ");
								if (args.length > 0 && args[0].length > 0) {
									max = parseInt(args[0]);
									if (max > 2147483647) max = 2147483647;
								}
							} catch (e) {
							}
							var num = ~~(Math.random() * max);
							api.sendMessage("@" + sender.name + ": You rolled " + num, thread.id);
							break;
						case "roulette":
							var rounds = 6;
							try {
								if (thread.id in roulette && "rounds" in roulette[thread.id]) {
									rounds = roulette[thread.id]["rounds"];
								} else {
									roulette[thread.id] = { };
								}
							} catch (e) { }
							var chance = (rounds > 0) ? 1 - (1 / rounds) : 1;
							var dead = Math.random() > chance;
							rounds -= 1;
							roulette[thread.id]["rounds"] = rounds;
							if (dead) {
								roulette[thread.id]["rounds"] = 6;
								api.sendMessage("@" + sender.name + ": Bam! You're dead!", thread.id, function() {
									if (!("kicked" in roulette[thread.id])) {
										roulette[thread.id]["kicked"] = [];
									}
									roulette[thread.id]["kicked"] = []; /*.push({
										id: sender.id,
										until: ~~(moment().format("X") + 1)
									});*/
									console.log(roulette[thread.id]);
									// api.sendMessage("kicking " + sender.name, thread.id);
									api.removeUserFromGroup(sender.id, thread.id);
								});
							} else {
								if (rounds == 1) {
									roulette[thread.id]["rounds"] = 6;
									api.sendMessage(sender.name + " wins!", thread.id);
								} else {
									api.sendMessage("@" + sender.name + ": Blank. There's " + rounds + " round" + (rounds > 1 ? "s" : "") + " left...", thread.id);
								}
							}
							break;
						case "help":
							// api.sendMessage(domain + "/about#help", thread.id);
							// break;
						case "rules":
							// api.sendMessage(domain + "/about#rules", thread.id);
							// break;
							api.sendMessage("facebook blocked me from sending links.", thread.id);
						default:
							api.sendMessage("visit mikalbot-failedxyz . c9users . io to see commands", thread.id);
							break;
					}
				}
			});
		}
	});
});
});