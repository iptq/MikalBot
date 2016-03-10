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
var wolfram = require("wolfram-alpha").createClient(process.env.WOLFRAM_ALPHA_APPID);

var locations = require("./locations");
var db = low("database.json", { storage: storage });

var app = express();
var domain = "http://bot.michaelz.xyz";

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

if (!Array.prototype.last){
	Array.prototype.last = function(){
		return this[this.length - 1];
	};
};

var download = function(uri, filename, callback){
	request.head(uri, function(err, res, body) {
		request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
	});
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
app.get("/spyfall", function(req, res) {
	res.render("pages/spyfall", { locations: locations.map(function(obj) {
		return obj["name"].split(".")[1];
	}) });
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
var game = {};

db._.mixin({
	randomize: function(array) {
		return array[~~(Math.random()*array.length)];
	}
});

try {
	fs.statSync("data.json");
	var data = jsonfile.readFileSync("data.json");
	activity = data["activity"] || {};
	game = data["game"] || {};
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


app.listen(3000, "0.0.0.0", function() {
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
		for(thread in game) {
			var remain = [];
			if ("kicked" in game[thread]) {
				for(var i=0; i<game[thread]["kicked"].length; i++) {
					user = game[thread]["kicked"][i];
					// console.log(user["until"] + " " + ~~(moment().format("X")));
					if (user["until"] < ~~(moment().format("X"))) {
						api.addUserToGroup(user["id"], thread);
					} else {
						remain.push(user);
					}
				}
			}
			game[thread]["kicked"] = []; // remain;
		}
		console.log(game);
		var savedata = {
			"activity": activity,
			"game": game,
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
				
				var predicate = { "to": sender.id, "thread": thread.id };
				var messages = db("messages").filter(predicate);
				if (messages.length > 0) {
					var response = "Hey " + sender.name + ", " + (messages.length == 1 ? "this": "these") + " message" + (messages.length == 1 ? " was": "s were") + " left for you when you were offline:";
					for(var i=0; i<messages.length; i++) {
						var m = messages[i];
						response += "\n- " + (moment(m["timestamp"], "X").fromNow()) + ", " + m["from_name"] + " said:" + m["message"];
					}
					api.sendMessage(response, thread.id);
					db("messages").remove(predicate);
				}
				
				// Hardcoded Stuff
				var hour = ~~(new Date()).getUTCHours();
				if (sender.id == "100003896281163" && thread.id == "1475239659451137" && hour >= 8 && hour < 12) {
					api.sendMessage("GO TO SLEEP MICHELLE", "1475239659451137");
				}
				
				if (thread.id == "1475239659451137" && message.toLowerCase().indexOf("team") >= 0) {
					api.sendMessage("team?", thread.id);
				}
				
				/*
				if (sender.id == "100000466030348" && thread.id == "1475239659451137") {
					activity[thread.id][sender.id]["activity"] = 0;
				}
				*/
				if (sender.id == "100000919104182" && thread.id == "521751258001669") {
					activity[thread.id][sender.id]["activity"] = 0;
				}
				
				if (message.startsWith("!")) {
					switch(message.substring(1).split(" ")[0].toLowerCase()) {
						case "level":
							var uid = sender.id;
							var name = sender.name;
							var you = false;
							try {
								var arg = message.split("!level ")[1];
								if (arg.length > 0) {
									name = arg;
									var user = getUserDataByName(name);
									if (!user) user = getUserDataByFirstName(name);
									if (user) {
										uid = user["id"];
										name = user["name"];
									}
								}
							} catch (e) {
								uid = sender.id;
								name = sender.name;
							}
							var xp = Math.round(100*activity[thread.id][uid]["experience"])/100;
							var level = getLevel(xp);
							var percent = Math.round(getPercentToNextLevel(xp) * 10000) / 100;
							api.sendMessage(name + (you ? ": You are" : " is") + " level " + level + " (" + xp + "xp, " + percent + "%)!", thread.id);
							break;
						case "leaderboard":
						case "stats":
							api.sendMessage("current leaderboard: " + domain + "/stats/" + thread.id, thread.id);
							break;
							/*
							var url = domain + "/stats/" + thread.id + "?images=yes";
							console.log("capturing " + url + "...");
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
							*/
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
						case "tell":
							try {
								var rec = message.split("!tell ")[1].split(":")[0];
								console.log(rec);
								var msg = message.split(message.split(":")[0] + ":")[1];
								var user = getUserDataByName(rec);
								if (!user) user = getUserDataByFirstName(rec);
								var gender = user["gender"];
								db("messages").push({ "from": sender.id, "from_name": sender.name, "to": user["id"], "to_name": user["name"], message: msg, timestamp: ~~(moment().format("X")), thread: thread.id });
								api.sendMessage(sender.name + ": I'll tell " + (gender == 1 ? "her" : "him") + " when " + (gender == 1 ? "she" : "he") + " comes back online.", thread.id);
							} catch (e) {
								console.log(e);
								api.sendMessage("Usage: !tell <user>:<msg>", thread.id);
							}
							break;
						case "roulette":
							var rounds = 6;
							try {
								if (thread.id in game && "rounds" in game[thread.id]) {
									rounds = game[thread.id]["rounds"];
								} else {
									game[thread.id] = { };
								}
							} catch (e) { }
							var chance = (rounds > 0) ? 1 - (1 / rounds) : 1;
							var dead = Math.random() > chance;
							rounds -= 1;
							game[thread.id]["rounds"] = rounds;
							if (dead) {
								game[thread.id]["rounds"] = 6;
								api.sendMessage("@" + sender.name + ": Bam! You're dead!", thread.id, function() {
									if (!("kicked" in game[thread.id])) {
										game[thread.id]["kicked"] = [];
									}
									game[thread.id]["kicked"] = []; /*.push({
										id: sender.id,
										until: ~~(moment().format("X") + 1)
									});*/
									console.log(game[thread.id]);
									// api.sendMessage("kicking " + sender.name, thread.id);
									api.removeUserFromGroup(sender.id, thread.id);
								});
							} else {
								if (rounds == 1) {
									game[thread.id]["rounds"] = 6;
									api.sendMessage(sender.name + " wins!", thread.id);
								} else {
									api.sendMessage("@" + sender.name + ": Blank. There's " + rounds + " round" + (rounds > 1 ? "s" : "") + " left...", thread.id);
								}
							}
							break;
						case "ask":
							try {
								var query = message.split("!ask ")[1];
								wolfram.query(query, function(err, result) {
									try {
										if (err) {
											console.err(err);
										} else {
											if (result.length == 0) throw "";
											var index = 1;
											for(var i=0; i<result.length; i++) {
												if (result[i]["primary"] === true) {
													index = i;
													break;
												}
											}
											var subpod = result[index]["subpods"][0];
											var obj = {};
											if ("image" in subpod) {
												var filename = "tmp/" + token() + ".gif";
												download(subpod["image"], filename, function() {
													obj["attachment"] = fs.createReadStream(filename);
													api.sendMessage(obj, thread.id);
												});
											} else {
												throw "";
											}
										}
									} catch (e) {
										api.sendMessage("@" + sender.name + ": What?", thread.id);
									}
								});
							} catch (e) {
								api.sendMessage("@" + sender.name + ": What?", thread.id);
							}
							break;
						case "spyfall":
							try {
								var command = message.split("!spyfall ")[1].split(" ")[0].toLowerCase();
								switch(command) {
									case "new":
										var has_game = (thread.id in game) && ("spyfall_status" in game[thread.id]);
										if (has_game && game[thread.id]["spyfall_status"] == 2) {
											api.sendMessage("There's already a game started.", thread.id);
										} else {
											if (!(thread.id in game)) {
												game[thread.id] = { };
											}
											game[thread.id]["spyfall_players"] = [];
											game[thread.id]["spyfall_status"] = 1;
											api.sendMessage("Who wants to play Spyfall? Reply with !spyfall join.", thread.id);
										}
										break;
									case "join":
										var has_game = (thread.id in game) && ("spyfall_status" in game[thread.id]);
										if (!has_game || game[thread.id]["spyfall_status"] == 0) {
											api.sendMessage("There's no ongoing game right now. Reply with !spyfall new to find players.", thread.id);
										} else if (game[thread.id]["spyfall_status"] == 2) {
											api.sendMessage("There's already a game started.", thread.id);
										} else {
											if (game[thread.id]["spyfall_players"].indexOf(sender.id) == -1) {
												game[thread.id]["spyfall_players"].push(sender.id);
											}
											api.sendMessage("@" + sender.name + ": You're all set!", thread.id);
										}
										break;
									case "players":
										var has_game = (thread.id in game) && ("spyfall_status" in game[thread.id]);
										if (!has_game || game[thread.id]["spyfall_status"] == 0) {
											api.sendMessage("There's no ongoing game right now. Reply with !spyfall new to start one.", thread.id);
										} else {
											var players = game[thread.id]["spyfall_players"].map(function(currentValue, index, array) {
												return getUserData(currentValue, "firstName");
											});
											api.sendMessage("Current players: " + players.join(", "), thread.id);
										}
										break;
									case "start":
										var has_game = (thread.id in game) && ("spyfall_status" in game[thread.id]);
										if (has_game && game[thread.id]["spyfall_status"] != 1) {
											api.sendMessage("There's already a game started.", thread.id);
										} else {
											game[thread.id]["spyfall_status"] = 2;
											var players = game[thread.id]["spyfall_players"];
											var spy_index = ~~(Math.random() * players.length);
											var first_index = ~~(Math.random() * players.length);
											var new_players = { };
											var location_index = ~~(Math.random() * locations.length);
											(function next(i) {
												if (i == players.length) {
													console.log(new_players);
													game[thread.id]["spyfall_directory"] = new_players;
													api.sendMessage("All roles have been assigned. You can start asking questions!\n" + getUserData(players[first_index], "name") + " is first.", thread.id);
												} else {
													if (i == spy_index) {
														new_players[players[i]] = {
															spy: true,
														};
														api.sendMessage("You are the spy!", players[i], function() {
															next(i + 1);
														});
													} else {
														var role_index = ~~(Math.random() * locations[location_index]["roles"].length);
														var plocation = locations[location_index]["name"].split(".").last();
														var prole = locations[location_index]["roles"][role_index].split(".").last();
														new_players[players[i]] = {
															spy: false,
															location: plocation,
															role: prole
														};
														api.sendMessage("You aren't the spy!\nLocation: " + plocation + ", Role: " + prole, players[i], function() {
															next(i + 1);
														});
													}
												}
											})(0);
										}
										break;
									case "end":
										delete game[thread.id]["spyfall_players"];
										delete game[thread.id]["spyfall_status"];
										delete game[thread.id]["spyfall_directory"];
										api.sendMessage("Game over. Start a new one with !spyfall new.", thread.id);
										break;
									default:
										throw "Unknown command.";
										break;
								}
							} catch (e) {
								api.sendMessage("Usage: !spyfall <command> <arguments> (Error: " + e.toString() + ")", thread.id);
							}
							break;
						case "help":
							try {
								api.sendMessage(domain + "/about#help", thread.id);
							} catch (e) {
								api.sendMessage("visit " + domain + " to see commands", thread.id);
							}
							break;
						case "rules":
							try {
								api.sendMessage(domain + "/about#rules", thread.id);
							} catch (e) {
								api.sendMessage("visit " + domain + " to see commands", thread.id);
							}
							break;
							// api.sendMessage("facebook blocked me from sending links.", thread.id);
						default:
							api.sendMessage("visit " + domain + " to see commands", thread.id);
							break;
					}
				}
			});
		}
	});
});
});
