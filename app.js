var fs = require("fs");
var path = require("path");
var chainsaw = require("chainsaw");
var child_process = require("child_process");

var Watcher = require("./lib/Watcher");
var Ripper = require("./lib/Ripper");

var config = require("./config");

function run(volume) {
	var ripper = new Ripper(volume);
	ripper.run();
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
