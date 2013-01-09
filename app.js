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
var watcher = new Watcher(config.source, true);
watcher.on("change", run);
