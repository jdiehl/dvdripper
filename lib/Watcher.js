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

function Watcher(source, run_initially) {
	events.EventEmitter.call(this);
	var self = this;
	this.source = source;

	// watcher event
	var _seen = {};
	function _onChange(event, filename) {
		var _newSeen = {};
		_eachFile(self.source, function (file) {
			_newSeen[file] = true;
			if (!_seen[file]) {
				self.emit("change", path.join(self.source, file));
			}
		});
		_seen = _newSeen;
	}

	// mark all existing files as seen
	_eachFile(self.source, function (file) {
		_seen[file] = true;
		if (run_initially) {
			self.emit("change", path.join(self.source, file));
		}
	});

	this.watcher = fs.watch(this.source, _onChange);
}

// make Watcher an event emitter
sys.inherits(Watcher, events.EventEmitter);

// exports
module.exports = Watcher;
