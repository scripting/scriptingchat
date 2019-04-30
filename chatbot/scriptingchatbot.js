var myVersion = "0.4.3", myProductName = "scriptingchatbot";

const request = require ("request");
const utils = require ("daveutils");
const fs = require ("fs");
const feedRead = require ("davefeedread");
const qs = require ("querystring");
const davehttp = require ("davehttp"); 

var config = {
	urlChatServer: "http://chat.scripting.com:1412/",
	urlFeed: "http://scripting.com/rss.xml",
	timeOutSecs: 30,
	myIcon: "http://static.scripting.com/larryKing/images/2012/10/16/clarus.gif",
	pingCallback: {
		port: 1414,
		path: "feedping"
		},
	oauthToken: undefined,
	oauthTokenSecret: undefined
	};
const fnameConfig = "config.json";

var stats = {
	ctStarts: 0,
	whenLastStart: undefined,
	flFirstCheck: true,
	ctWrites: 0,
	ctItems: 0,
	ctItemsPosted: 0,
	whenLastPost: undefined,
	ctNotificationRequests: 0,
	whenLastNoficationRequest: undefined,
	items: {
		}
	};
const fnameStats = "stats.json";
var flStatsChanged = false;
var flRequestedNotification = false;

function statsChanged () {
	flStatsChanged = true;
	}
function buildParamList (params) { 
	var s = "";
	for (var x in params) {
		if (s.length > 0) {
			s += "&";
			}
		s += x + "=" + encodeURIComponent (params [x]);
		}
	return (s);
	}
function serverCall (verb, params, flAuthenticated, callback, method, postbody) {
	if (flAuthenticated === undefined) {
		flAuthenticated = true;
		}
	if (params === undefined) {
		params = new Object ();
		}
	if (method === undefined) {
		method = "GET";
		}
	if (flAuthenticated) {
		params.oauth_token = config.oauthToken;
		params.oauth_token_secret = config.oauthTokenSecret;
		}
	
	var apiUrl = config.urlChatServer + verb;
	var paramString = buildParamList (params);
	if (paramString.length > 0) {
		apiUrl += "?" + paramString;
		}
	
	
	var theRequest = {
		uri: apiUrl,
		form: postbody
		};
	request.post (theRequest, function (err, res, body) {
		if (callback !== undefined) {
			callback (err, res, body);
			}
		});
	}
function postToChat (theMessage, callback) {
	var jstruct = {
		text: theMessage,
		authorname: myProductName,
		urlIcon: config.myIcon,
		source: myProductName + " v" + myVersion
		};
	serverCall ("post", undefined, true, callback, "POST", utils.jsonStringify (jstruct));
	}
function postItemToChat (guid, item) {
	var htmltext;
	if (item.title !== undefined) {
		var title = "<a href=\"" + guid + "\">" + item.title + "</a>";
		if (item.description !== undefined) {
			htmltext = "<div class=\"divRssMsgTitle\">" + title + "</div>\r<div class=\"divRssMsgBody\">" + item.description + "</div>";
			}
		else {
			htmltext = "<div class=\"divRssMsgBody\">" + title + "</div>";
			}
		}
	else {
		if (item.description !== undefined) {
			var permalink = "<span class=\"spRssPermalink\"><a href=\"" + guid + "\">#</a></span>";
			htmltext = "<div class=\"divRssMsgBody\">" + item.description + permalink + "</div>";
			}
		}
	console.log ("postItemToChat: guid == " + guid);
	postToChat (htmltext);
	stats.ctItemsPosted++;
	stats.lastPostHtml = htmltext;
	stats.whenLastPost = new Date ();
	statsChanged ();
	}
function pleaseNotify (theCloud, callback) {
	var urlCloudServer = "http://" + theCloud.domain + ":" + theCloud.port + theCloud.path;
	var now = new Date ();
	var theRequest = {
		url: urlCloudServer,
		followRedirect: true, 
		headers: {Accept: "application/json"},
		method: "POST",
		form: {
			port: config.pingCallback.port,
			path: config.pingCallback.path,
			url1: config.urlFeed,
			protocol: "http-post"
			}
		};
	console.log ("pleaseNotify: theRequest == " + utils.jsonStringify (theRequest));
	request (theRequest, function (err, response, body) {
		if (err) {
			console.log ("pleaseNotify: err.message == " + err.message);
			}
		else {
			console.log ("pleaseNotify: response == " + utils.jsonStringify (response));
			}
		});
	}
function handlePing (feedUrl, callback) {
	checkFeed ();
	}
function startServer () {
	var httpconfig = {
		port: config.pingCallback.port,
		flPostEnabled: true,
		flLogToConsole: true
		};
	davehttp.start (httpconfig, function (theRequest) {
		console.log ("davehttp.start: theRequest.lowerpath == " + theRequest.lowerpath + ", theRequest.method == " + theRequest.method);
		if (theRequest.lowerpath == ("/" + config.pingCallback.path)) {
			var jstruct = qs.parse (theRequest.postBody);
			console.log (theRequest.lowerpath + " -- jstruct.url == " + jstruct.url);
			handlePing (jstruct.url, function (err, data) {
				theRequest.httpReturn (200, "text/plain", "Thanks for the update! ;-)");
				});
			}
		else {
			theRequest.httpReturn (404, "text/plain", "Not found.");
			}
		});
	}
function checkFeed (callback) {
	const whenstart = new Date ();
	function ifNotNull (val) {
		if (val == null) {
			return (undefined);
			}
		else {
			return (val);
			}
		}
	feedRead.parseUrl (config.urlFeed, config.timeOutSecs, function (err, theFeed) {
		if (err) {
			console.log ("checkFeed: err.message == " + err.message);
			}
		else {
			theFeed.items.forEach (function (item) {
				if (item.guid !== undefined) {
					if (stats.items [item.guid] === undefined) { //new item
						var statsitem = {
							title: ifNotNull (item.title),
							description: ifNotNull (item.description),
							when: whenstart
							};
						stats.items [item.guid] = statsitem;
						stats.ctItems++;
						statsChanged ();
						console.log ("checkFeed: new item guid == " + item.guid);
						if (!stats.flFirstCheck) {
							postItemToChat (item.guid, statsitem);
							}
						}
					}
				});
			}
		stats.flFirstCheck = false;
		statsChanged ();
		
		if (theFeed.head.cloud !== undefined) {
			if (!flRequestedNotification) {
				console.log (utils.jsonStringify (theFeed.head.cloud));
				pleaseNotify (theFeed.head.cloud, callback);
				flRequestedNotification = true; //once per run
				stats.ctNotificationRequests++;
				stats.whenLastNoficationRequest = new Date ();
				statsChanged ();
				}
			}
		
		if (callback !== undefined) {
			callback ();
			}
		});
	}
function loadJsonFile (fname, obj, callback) {
	fs.readFile (fname, function (err, jsontext) {
		if (err) {
			console.log ("loadJsonFile: err.message == " + err.message);
			}
		else {
			try {
				var jstruct = JSON.parse (jsontext);
				for (var x in jstruct) {
					obj [x] = jstruct [x];
					}
				}
			catch (err) {
				console.log ("loadJsonFile: err.message == " + err.message);
				}
			}
		callback ();
		});
	}
function everySecond () {
	if (flStatsChanged) {
		stats.ctWrites++;
		flStatsChanged = false;
		fs.writeFile (fnameStats, utils.jsonStringify (stats), function (err) {
			});
		}
	}
function everyMinute () {
	var now = new Date ();
	console.log ("\n" + myProductName + " v" + myVersion + ": " + now.toLocaleTimeString ());
	checkFeed ();
	}
function everyHour () {
	flRequestedNotification = false; //do another one every hour
	}

loadJsonFile (fnameConfig, config, function () {
	loadJsonFile (fnameStats, stats, function () {
		console.log ("\n" + myProductName + " v" + myVersion);
		stats.ctStarts++;
		stats.whenLastStart = new Date ();
		statsChanged ();
		startServer ();
		checkFeed ();
		setInterval (everyHour, 60 * 60 * 1000); 
		setInterval (everySecond, 1000); 
		utils.runEveryMinute (everyMinute);
		});
	});
	
