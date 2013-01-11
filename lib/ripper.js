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
		if (callback) callback();
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
		tmdb.movie.info(movie.id, "casts,keywords", function (err, res) {
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

// find all audio tracks for a given language
function _audioTracksMatchingLanguage(title, language) {
	var tracks = [];
	for (var key in title.audio) {
		var track = title.audio[key];
		if (language.test(track.lang)) {
			track.id = key;
			tracks.push(track);
		}
	}
	return tracks;
}

// select the best audio track from the given tracks
function _selectBestAudioTrack(audio, tracks) {
	if (tracks.length === 0) return;
	if (audio.length === 0) {
		for (var i in tracks) {
			var track = tracks[i];
			if (track.codec === "AC3" && track.channels === "5.1 ch") {
				audio.push(track.id);
				audio.push(track.id);
				return;
			}
		}
	}
	audio.push(tracks[0].id);
}

// select the appropriate audio tracks
function _selectAudioTracks(title) {
	var languages = [/englisc?h/i, /(german|deutsch)/i];
	var audio = [];
	languages.forEach(function (language) {
		var tracks = _audioTracksMatchingLanguage(title, language);
		_selectBestAudioTrack(audio, tracks);
	});
	return audio;
}

function _caffeinate(job, callback) {
	var child = child_process.spawn(config.caffeinate);
	return child.kill.bind(child);
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

	// description
	self.toString= function () {
		var info = self.info;
		if (!info) return "Unknown/No Disk";
		var lines = [];
		function add(label, value) {
			if (value) lines.push("  " + label + ": " + value);
		}
		lines.push("Disk: " + input);
		add("Title", info.title);
		add("Date", info.release_date);
		add("Runtime", info.runtime);
		add("Description", info.description);
		return lines.join("\n");
	};

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
		var title = _findMainTitle(self.info.titles);
		var tracks = _selectAudioTracks(title);
		if (tracks.length < 1) {
			console.log("Could not find any audio tracks, ripping first");
			tracks = [1];
		}
		handbrake.rip(input, self.output, title.id, tracks, callback);
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
			var resume = _caffeinate();
			self.rip(function () {

				// launch iVI
				child_process.exec("open -a \"iVI Pro\" \"" + self.output + "\"");

				// eject disk
				self.eject(function () {
					console.log("DONE");
					resume();
					if (callback) callback();
				});
			});
		});
	};
}

module.exports = Ripper;
