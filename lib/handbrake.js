var config = require("../config.json");
var child_process = require("child_process");

// convert a formatted string hh:mm:ss to the number of seconds
function _strToTime(string) {
	var info = string.split(":");
	return parseInt(info[0], 10) * 3600 + parseInt(info[1], 10) * 60 + parseInt(info[2], 10);
}

function _joinAudioTracks(audio, index) {
	var r = [];
	audio.forEach(function (t) {
		r.push(t[index]);
	});
	return r.join(",");
}

// interpret the output from handbrake
var RE_TITLE = /^\+ title (\d+)/;
var RE_META = /^ {2}\+ ([^:]+): *(.*)/;
var RE_AUDIO = /^ {4}\+ (\d+), (\w+) \(([^)]+)\) \(([^)]+)\) \(([^)]+)\)/;
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
		var ch = /ch/.test(match[5]) ? match[5] : match[4];
		title.audio[match[1]] = { lang: match[2], codec: match[3], channels: ch };
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
		if (callback) callback(titles, stderr);
	});
}

// Rip the DVD
function rip(input, output, titles, audioTracks, quality, callback) {

	var args = [
		"-i" + input,
		"-o" + output,
		"-t" + titles,
		"-m",
		"-4",
		"--loose-anamorphic",
		"--modulus", 2,
		"-X1920",
		"-ex264",
		"--x264-tune=film",
		"-q" + quality,
		"-5",
		"-r30",
		"--pfr",
		"-x" + "b-adapt=2:psnr=0:ssim=0",
		"-a" + _joinAudioTracks(audioTracks, 0),
		"-E" + _joinAudioTracks(audioTracks, 1)
	];

	console.log(config.handbrake + " " + args.join(" "));
	var child = child_process.spawn(config.handbrake, args, { stdio: "inherit" });
	child.on("exit", function (code) {
		if (callback) callback();
	});
}

exports.scan = scan;
exports.rip = rip;
