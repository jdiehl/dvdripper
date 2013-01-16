var fs = require("fs");
var path = require("path");
var chainsaw = require("chainsaw");
var child_process = require("child_process");

var Watcher = require("./lib/Watcher");
var Ripper = require("./lib/Ripper");
var notify = require("./lib/notify");

var config = require("./config");

function _caffeinate() {
	var child = child_process.spawn(config.caffeinate);
	return child.kill.bind(child);
}

function _iTunes(file, callback) {
	var cmd = "osascript << APPLESCRIPT\n" +
		"tell application \"iTunes\" to add POSIX file \"" + file + "\"\n" +
		"APPLESCRIPT";
	child_process.exec(cmd, callback);
}

var RE_MOUNT = /^\/dev\/disk[12] on (.+) \(/;
function _getDVDPath(callback) {
	child_process.exec("mount", function (error, stdout, stderr) {
		var input;
		stdout.split("\n").forEach(function (line) {
			var match = line.match(RE_MOUNT);
			if (match) {
				input = match[1];
				return false;
			}
		});
		if (input) {
			callback(input);
		} else {
			child_process.exec("sleep 1", function () {
				_getDVDPath(callback);
			});
		}
	});
}

function run(volume) {
	var resume = _caffeinate();
	var ripper = new Ripper(volume);
	ripper.run(function () {

		// stop
		if (!ripper.output) {
			resume();
			return;
		}

		// open iVI if metadata is missing
		if (!ripper.info.description) {
			child_process.exec("open -a \"iVI Pro\" \"" + ripper.output + "\"");
		}

		// add to itunes
		_iTunes(ripper.output);

		// send notification
		notify.notify("DVDRipper", "Your movie (" + ripper.info.title + ") is ready!");

		// inform that user that we are done
		console.log("DONE RIPPING.");
		console.log(ripper.toString());

		// sleep 1 minute, then resume
		child_process.exec("sleep 60", resume);
	});
}

/*
// initialize the watcher
var watcher = new Watcher(config.source, true);
watcher.on("change", run);
*/

/*
// load dvds
fs.readdir(config.source, function (err, files) {
	files.forEach(function (file) {
		if (file[0] === "." || config.source_ignore.indexOf(file) >= 0) return;
		run(path.join(config.source, file));
	});
});
*/

// wait for dvd mount
_getDVDPath(function (input) {
	run(input);
});
