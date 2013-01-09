var path = require("path");
var fs = require("fs");
var config = require("../config");

function _filename(input) {
	if (!config.cache) return undefined;
	return path.join(config.cache, path.basename(input) + ".json");
}

function load(input, callback) {
	fs.readFile(_filename(input), function (error, data) {
		callback(data ? JSON.parse(data) : undefined);
	});
}

function save(input, info, callback) {
	if (config.cache && info) {
		var data = JSON.stringify(info, null, "\t");
		fs.writeFile(_filename(input), data, callback);
	}
}

exports.load = load;
exports.save = save;
