var config = require("../config.json");
var genres = require("../genres.json");

var path = require("path");
var fs = require("fs");
var child_process = require("child_process");
var tmdb = require('tmdbv3').init(config.tmdb_key);
var discident = require("discident");

var handbrake = require("./handbrake");
var cache = require("./cache");

// Beautify a string
function _beautify(string) {
	var output = [];
	string.split(/[ _\-\.]/).forEach(function (word) {
		word = word[0].toUpperCase() + word.slice(1).toLowerCase();
		output.push(word);
	});
	return output.join(" ");
}

// match an itunes genre
function _genre(string) {
	string = string.split(" ");
	for (var id in genres) {
		for (var i in string) {
			if (genres[id].search(string[i]) >= 0) {
				return id;
			}
		}
	}
	return undefined;
}

// Determine an appropriate output path
function _output(info) {
	var name = path.join(config.destination, info.title);
	var ext = ".mp4";
	var output = name + ext;
	var i = 0;
	while (fs.existsSync(output)) {
		i++;
		output = name + " " + i + ext;
	}
	return output;
}

// eject the disk
function _eject(input, callback) {
	var command = config.eject + " \"" + input + "\"";
	child_process.exec(command, function (error, stdout, stderr) {
		callback();
	});
}

// query the movie db (search and info)
function _queryTMDB(title, year, callback) {
	tmdb.search.movie(title, { include_adult: false, year: year }, function (err, res) {
		if (!res || !res.results || !res.results[0]) {
			callback();
			return;
		}

		// query details
		var movie = res.results[0];
		tmdb.movie.info(movie.id, function (err, res) {
			callback(res ? res : movie);
		});
	});
}

// find the main title
function _findMainTitle(titles) {
	var main;
	titles.forEach(function (title) {
		if (!main || parseInt(title.duration, 10) > parseInt(main.duration, 10)) {
			main = title;
		}
	});
	return main;
}

// select the appropriate audio tracks
function _selectAudioTracks(info) {
	var title = _findMainTitle(info.titles);
	var languages = [/englisc?h/i, /(german|deutsch)/i];
	var tracks = [];
	languages.forEach(function (match) {
		for (var key in title.audio) {
			var track = title.audio[key];
			if (track.codec !== "AC3" || track.channels !== "5.1 ch") continue;
			if (!match.test(track.lang)) continue;
			tracks.push(key);
			tracks.push(key);
			return;
		}
	});
	return tracks;
}

function Ripper(input) {
	var self = this;
	self.input = input;

	// write metadata
	function writeMetadata(m, callback) {

		var args = [
			"\"" + m.output + "\"",
			"--stik Movie"
		];
		function add(key, value) {
			if (value) args.push("--" + key + " \"" + value + "\"");
		}
		add("title", m.title);
		add("year", m.date ? m.date : m.year);
		add("description", m.outline);
		add("geID", m.geID);

		var command = config.atomicparsley + " " + args.join(" ");
		child_process.exec(command, function (error, stdout, stderr) {
			callback();
		});
	}

	// identify the disk from discident and tmdb
	function _identify(callback) {
		handbrake.scan(input, function (titles) {
			if (!titles || titles.length === 0) {
				callback(false);
				return;
			}
			var info = self.info = {};
			info.titles = titles;

			// discident
			discident.identify(input, function (discident) {
				if (discident) {
					info.title = discident.title;
				} else {
					info.title = _beautify(path.basename(self.input));
				}
				_queryTMDB(info.title, discident.year, function (res) {
					if (res) {
						info.title = res.title;
						info.date = res.release_date;
						info.image = res.poster_path;
						info.runtime = res.runtime;
						info.description = res.overview;
						// m.geID = _genre(res.genre);
					}
					callback(true);
				});
			});
		});
	}

	// scan & identify the disk
	self.identify = function identify(callback) {
		cache.load(input, function (info) {
			if (info) {
				self.info = info;
				callback(true);
				return;
			}
			_identify(function (success) {
				if (success) {
					cache.save(input, self.info, function () {
						callback(true);
					});
				} else {
					callback(false);
				}
			});
		});
	};

	// rip the disk
	self.rip = function rip(callback) {
		self.output = _output(self.info);
		var tracks = _selectAudioTracks(self.info);
		if (tracks.length < 1) {
			console.log("Could not find any audio tracks");
			return;
		}
		handbrake.rip(input, self.output, tracks, callback);
	};

	// eject the disk
	self.eject = function eject(callback) {
		_eject(input, callback);
	};

	// automatic execution
	self.run = function run(callback) {
		console.log("Identify Disk:", input);
		self.identify(function (success) {
			if (!success) return;
			console.log("Ripping Disk:", self.info);
			self.rip(function () {
				self.eject();
				console.log("DONE");
			});
		});
	};
}

module.exports = Ripper;
