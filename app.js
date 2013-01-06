var Watcher = require("./lib/Watcher");
var identifier = require("./lib/identifier");
var ripper = require("./lib/ripper");

var config = require("./config");
var fs = require("fs");
var path = require("path");

// var watcher = new Watcher(config.source);
// watcher.on("change", function (volume) {
// 	console.log(volume);
// });

function cacheFilename(m) {
	return path.join(config.cache, path.basename(m.input) + ".json");
}

function loadCache(m, callback) {
	if (!config.cache) {
		callback(false);
		return;
	}
	fs.readFile(cacheFilename(m), function (error, data) {
		if (!data) {
			callback(false);
		} else {
			m = JSON.parse(data);
			callback(true);
		}
	});
}

function saveCache(m, callback) {
	if (config.cache) {
		var data = JSON.stringify(m, null, "\t");
		fs.writeFile(cacheFilename(m), data, function (error) {
			if (error) {
				console.error("Could not write cache:", error);
			}
			if (callback) callback(m);
		});
	}
}

function identify(m, callback) {
	identifier(m)
	.queryVolume()
	.queryDiscident()
	.queryTMDB()
	.queryTMDBDetails()
	.do(callback);
}

function rip(m, callback) {
	ripper(m)
	.scan()
	.rip()
	.do(callback);
}

var m = { input: "/Volumes/FROM_DUSK_TILL_DAWN"};
loadCache(m, function (success) {
	if (success) {
		rip(m);
	} else {
		identify(m, function (m) {
			saveCache(m);
			rip(m);
		});
	}
});
