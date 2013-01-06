var config = require("../config.json");
var child_process = require("child_process");
var fs = require("fs");
var path = require("path");
var chainsaw = require("chainsaw");

function _exec(command, callback) {
	console.log(command.join(" "));
	return child_process.exec(command.join(" "), callback);
}

function _strToTime(string) {
	var info = string.split(":");
	return info[0] * 3600 + info[1] * 60 + info[2];
}

function _findLongestTitle(titles) {
	var longestTitle;
	titles.forEach(function (title) {
		if (!longestTitle || title.duration > longestTitle.duration) {
			longestTitle = title;
		}
	});
	return longestTitle;
}

function _findAudioForTitle(title) {
	var en, de;
	for (var key in title.audio) {
		var lang = title.audio[key].toLowerCase();
		if (!en && (lang === "english" || lang === "englisch")) {
			en = key;
		} else if (!de && (lang === "german" || lang === "deutsch")) {
			de = key;
		}
	}
	var audio = [];
	if (en) audio.push(en);
	if (de) audio.push(de);
	return audio;
}

var RE_TITLE = /^\+ title (\d+)/;
var RE_META = /^ {2}\+ ([^:]+): *(.*)/;
var RE_AUDIO = /^ {4}\+ (\d+), (\w+)/;
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
		title.audio[match[1]] = match[2];
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

// Determine an appropriate output path
function _output(m) {
	var name = path.join(config.destination, m.title);
	var ext = ".mp4";
	m.output = name + ext;
	var i = 0;
	while (fs.existsSync(m.output)) {
		i++;
		m.output = name + " " + i + ext;
	}
}

function ripper(m) {
	return chainsaw(function (saw) {

		// Scan the DVD
		this.scan = function () {
			console.log("Scanning DVD...");

			var command = [
				config.handbrake,
				"-i\"" + m.input + "\"",
				"--main-feature",
				"--scan"
			];
			_exec(command, function (error, stdout, stderr) {
				m.titles = _parseHandbrakeOutput(stderr);
				saw.next();
			});
		};

		// Rip the DVD
		this.rip = function () {
			console.log("Ripping DVD...");
			console.assert(m.titles, "Please scan the DVD before ripping.");

			var title = _findLongestTitle(m.titles);
			var audio = _findAudioForTitle(title);
			_output(m);

			var command = [
				config.handbrake,
				"-i\"" + m.input + "\"",
				"-o\"" + m.output + "\"",
				"--main-feature",
				"-a" + audio.join(","),
				"--preset=\"AppleTV 3\"",
				"-Ecopy,copy"
			];

			_exec(command, function (error, stdout, stderr) {
				_exec([config.eject, m.input], function (error, stdout, stderr) {
					saw.next();
				});
			});
		};

		this.do = function (callback) {
			saw.nest(callback, m);
		};

	});
}

module.exports = ripper;
