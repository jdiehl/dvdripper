var config = require("../config.json");
var child_process = require("child_process");

// convert a formatted string hh:mm:ss to the number of seconds
function _strToTime(string) {
	var info = string.split(":");
	return parseInt(info[0], 10) * 3600 + parseInt(info[1], 10) * 60 + parseInt(info[2], 10);
}

// interpret the output from handbrake
var RE_TITLE = /^\+ title (\d+)/;
var RE_META = /^ {2}\+ ([^:]+): *(.*)/;
var RE_AUDIO = /^ {4}\+ (\d+), (\w+) \(([^)]+)\) \(([^)]+)\)/;
function _parseHandbrakeOutput(info) {
	info = info.split("\n");
	var titles = [];
	var title;
	var mode;

	function parseTitle(line) {
		var match = line.match(RE_TITLE);
		if (!match) return false;
		title = { id: match[1], audio: {} };
		titles.push(title);
		return true;
	}

	function parseMeta(line) {
		var match = line.match(RE_META);
		if (!match) return false;
		var key = match[1];
		var value = match[2];
		if (key === "duration") {
			value = _strToTime(value);
		}
		if (value) {
			title[key] = value;
		} else {
			mode = key;
		}
		return true;
	}

	function parseAudio(line) {
		var match = line.match(RE_AUDIO);
		if (!match) return false;
		title.audio[match[1]] = { lang: match[2], codec: match[3], channels: match[4] };
		return true;
	}

	info.forEach(function (line) {
		if (parseTitle(line) || !title) return;
		if (parseMeta(line)) return;
		if (mode === "audio tracks") {
			parseAudio(line);
		}
	});

	return titles;
}

// Scan the DVD
function scan(input, callback) {
	var args = [
		"-i\"" + input + "\"",
		"-t0",
		"--scan"
	];
	var command = config.handbrake + " " + args.join(" ");
	child_process.exec(command, function (error, stdout, stderr) {
		var titles = _parseHandbrakeOutput(stderr);
		callback(titles);
	});
}

// Rip the DVD
function rip(input, output, audioTracks, callback) {
	var args = [
		"-i" + input,
		"-o" + output,
		"--main-feature",
		"--preset=AppleTV 3",
		"-a" + audioTracks.join(",")
	];

	console.log(config.handbrake + " " + args.join(" "));
	var child = child_process.spawn(config.handbrake, args);
	child.stdout.on("data", function (data) {
		// somehow this makes handbrake output progress info
		console.log("OUT", data.toString());
	});
	child.on("exit", function (code) {
		callback();
	});
}

exports.scan = scan;
exports.rip = rip;
