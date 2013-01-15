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

function run(volume) {
	var resume = _caffeinate();
	var ripper = new Ripper(volume);
	ripper.run(function () {
		child_process.exec("open -a \"iTunes\" \"" + ripper.output + "\"");
		notify.notify("DVDRipper", "Your movie (" + ripper.info.title + ") is ready!");
		console.log("DONE");
		process.sleep(1);
		resume();
	});
}

// initialize the watcher
// var watcher = new Watcher(config.source, true);
// watcher.on("change", run);

fs.readdir(config.source, function (err, files) {
	files.forEach(function (file) {
		if (file[0] === "." || config.source_ignore.indexOf(file) >= 0) return;
		run(path.join(config.source, file));
	});
});
