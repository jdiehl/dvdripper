var fs = require("fs");
var path = require("path");
var chainsaw = require("chainsaw");
var child_process = require("child_process");

var handbrake = require("./lib/handbrake");
var config = require("./config");

function timeString(time) {
	time = parseInt(time, 10);
	time = Math.round(time / 60);
	var h = ~~(time / 60);
	var m = time - h * 60;
	if (h < 10) h = "0" + h;
	if (m < 10) m = "0" + m;
	return h + ":" + m;
}

function countAudio(audio, languages) {
	var count = {};
	for (var l in languages) {
		count[l] = 0;
		var match = languages[l];
		for (var i in audio) {
			if (match.test(audio[i].lang)) {
				count[l]++;
			}
		}
	}

	var out = [];
	for (l in count) {
		out.push(l + ":" + count[l]);
	}
	return out.join("\t");
}

var LANGUAGES = { "en" : /englisc?h/i, "de": /(german|deutsch)/i };
function scan(file, callback) {
	handbrake.scan(file, function (titles, output) {
		var title = path.basename(file, ".mp4");
		if (titles.length === 0) {
			console.log(title);
		} else {
			var duration = timeString(titles[0].duration);
			var audio = countAudio(titles[0].audio, LANGUAGES);
			console.log(title + "\t" + duration + "\t" + audio);
		}
		callback();
	});
}

fs.readdir(config.destination, function (err, files) {
	if (err) throw err;
	var i = -1;
	function next() {
		i++;
		if (i >= files.length) return;
		if (files[i][0] === ".") return next();
		scan(path.join(config.destination, files[i]), next);
	}
	next();
});
