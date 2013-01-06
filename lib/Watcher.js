var sys = require("sys");
var fs = require("fs");
var path = require("path");
var events = require("events");

// iterate through a directory
function _eachFile(path, callback) {
	fs.readdir(path, function (err, files) {
		files.forEach(function (file) {
			if (file[0] !== ".") callback(file);
		});
	});
}

function Watcher(source) {
	events.EventEmitter.call(this);
	var self = this;
	this.source = source;

	// watcher event
	var _seen = {};
	function _onChange(event, filename) {
		_eachFile(self.source, function (file) {
			if (!_seen[file]) {
				_seen[file] = true;
				self.emit("change", path.join(self.source, file));
			}
		});
	}

	// mark all existing files as seen
	_eachFile(self.source, function (file) {
		_seen[file] = true;
	});

	this.watcher = fs.watch(this.source, _onChange);
}

// make Watcher an event emitter
sys.inherits(Watcher, events.EventEmitter);

// exports
module.exports = Watcher;
