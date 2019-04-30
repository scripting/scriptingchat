const myVersion = "0.4.0", myProductName = "scriptingChatServer";   

const chat = require ("./lib/chat.js");
const fs = require ("fs");

fs.readFile ("config.json", function (err, jsontext) {
	if (err) {
		console.log (err.message);
		}
	else {
		try {
			var jstruct = JSON.parse (jsontext);
			chat.start (jstruct);
			}
		catch (err) {
			console.log (err.message);
			}
		}
	});
