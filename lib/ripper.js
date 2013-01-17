var config = require("../config.json");
var genres = require("../genres.json");

var path = require("path");
var fs = require("fs");
var child_process = require("child_process");
var tmdb = require('tmdbv3').init(config.tmdb_key);
var discident = require("discident");
var plist = require("plist");
var request = require("request");

var handbrake = require("./handbrake");
var cache = require("./cache");

// Beautify a string
function _beautify(string) {
	var output = [];
	string.split(/[ _\-\.]/).forEach(function (word) {
		if (word.length > 0) {
			word = word[0].toUpperCase() + word.slice(1).toLowerCase();
			output.push(word);
		}
	});
	return output.join(" ");
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

// query the movie db (search and info)
function _queryTMDB(title, year, callback) {
	tmdb.configuration(function (err, conf) {
		tmdb.search.movie(title, { include_adult: false, year: year }, function (err, res) {
			if (!res || !res.results || !res.results[0]) {
				if (callback) callback();
				return;
			}

			// query details
			var movie = res.results[0];
			tmdb.movie.info(movie.id, "casts,releases", function (err, res) {
				if (callback) callback(conf, res ? res : movie);
			});
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

	function findTrack(type, channels, codec) {
		for (var i in tracks) {
			var track = tracks[i];
			if (codec && track.codec !== codec) continue;
			if (channels && track.channels !== channels) continue;
			audio.push([track.id, "ca_aac"]);
			audio.push([track.id, type]);
			return true;
		}
		return false;
	}

	if (findTrack("copy:ac3", "5.1 ch", "AC3")) return;
	if (findTrack("ffac3", "5.1 ch")) return;
	audio.push([tracks[0].id, "ca_aac"]);
}

// select the appropriate audio tracks
function _selectAudioTracks(title) {
	var languages = [/englisc?h/i, /(german|deutsch)/i];
	var audio = [];
	languages.forEach(function (language) {
		var tracks = _audioTracksMatchingLanguage(title, language);
		_selectBestAudioTrack(audio, tracks);
	});
	if (audio.length < 1) {
		console.log("Could not find any suitable audio tracks, ripping first");
		audio.push([1, "ca_aac"]);
	}
	return audio;
}

// match an itunes genre
function _genreID(string) {
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

// best size (>= 600)
function _bestSize(sizes) {
	var size, num;
	for (var i in sizes) {
		size = sizes[i];
		num = parseInt(size.substr(1), 10);
		if (num > 299) return size;
	}
	return size;
}

// image path
function _imagePath(conf, image) {
	if (!conf || !conf.images || !image) return undefined;
	return conf.images.base_url + _bestSize(conf.images.poster_sizes) + image;
}

// match an itunes genre
function _genre(info) {
	if (!info.genres || info.genres.length === 0) return undefined;
	return info.genres[0].name;
}

function _sortedValues(dict) {
	var values = [];
	for (var key in dict) {
		values.push(dict[key]);
	}
	return values;
}

// generate a plist of the cast
function _castList(info) {
	if (!info.cast || info.cast.length === 0) return undefined;
	var cast = {}, directors = [], producers = [];
	info.cast.forEach(function (person) {
		cast[parseInt(person.order, 10)] = { name: person.name };
	});
	info.crew.forEach(function (person) {
		if (person.job === "Director") {
			directors.push({ name: person.name });
		} else if (person.job === "Producer") {
			producers.push({ name: person.name });
		}
	});
	var list = {
		cast: _sortedValues(cast),
		directors: directors,
		producers: producers,
	};
	return plist.build(list).toString();
}

// get the director's name
function _director(info) {
	if (!info.crew || info.crew.length === 0) return undefined;
	info.crew.forEach(function (crew) {
		if (crew.job === "Director") return crew.name;
	});
	return info.crew[0].name;
}

// get the rating
function _rating(info) {
	if (!info.releases || !info.releases.countries) return undefined;
	for (var i in info.releases.countries) {
		var c = info.releases.countries[i];
		if (c.iso_3166_1 === "US") return c.certification;
	}
}

// determine whether the movie is in HD
function _quality(titles) {
	var title = _findMainTitle(titles);
	var width = parseInt(title.size, 10);
	if (width < 1280) return 20;
	if (width < 1920) return 21;
	return 22;

}

function Ripper(input) {
	var self = this;
	self.input = input;
	self.quality = 20;
	self.info = {};

	// description
	self.toString = function () {
		var info = self.info;
		if (!info) return "Unknown/No Disk";
		var lines = [];
		function add(label, value) {
			if (value) lines.push("  " + label + ": " + value);
		}
		lines.push("Input: " + input);
		lines.push("Output: " + self.output);
		add("Title", info.title);
		add("Date", info.release_date);
		add("Runtime", info.runtime);
		add("Description", info.description);
		return lines.join("\n");
	};

	self.loadCache = function (callback) {
		cache.load(input, function (info) {
			if (info) {
				console.log("Cache: " + info.title);
				self.info = info;
				if (callback) callback(true);
			} else {
				if (callback) callback(false);
			}
		});
	};

	self.scan = function (callback) {
		handbrake.scan(input, function (titles, scanOutput) {
			if (!titles || titles.length === 0) {
				console.log("Scan: failed");
				if (callback) callback(false);
				return;
			}
			console.log("Scan: " + titles.length + " titles");
			self.info.titles = titles;
			self.quality = _quality(titles);
			if (callback) callback(true);
		});
	};

	// scan & identify the disk
	self.identify = function (callback) {
		discident.identify(input, function (discident) {
			var info = self.info;
			if (discident) {
				console.log("Discident: " + discident.title);
				info.title = discident.title;
				info.year = discident.year;
			} else {
				info.title = _beautify(path.basename(self.input));
				console.log("Discident: none (using " + info.title + ")");
			}
			_queryTMDB(info.title, info.year, function (conf, res) {
				if (res) {
					console.log("TMDB: ", res.title);
					info.title = res.title;
					info.date = res.release_date;
					info.image = _imagePath(conf, res.poster_path);
					info.runtime = res.runtime;
					info.description = res.overview;
					info.genres = res.genres;
					info.cast = res.casts.cast;
					info.crew = res.casts.crew;
					info.rating = _rating(res);
				} else {
					console.log("TMDB: none");
				}
				if (callback) callback(true);
			});
		});
	};

	// rip the disk
	self.rip = function (callback) {
		self.output = _output(self.info);
		var title = _findMainTitle(self.info.titles);
		var tracks = _selectAudioTracks(title);
		handbrake.rip(input, self.output, title.id, tracks, self.quality, callback);
	};

	// write metadata
	self.writeMetadata = function(callback) {
		if (!self.info.description) {
			if (callback) callback();
			return;
		}
		var info = self.info;

		var args = [
			self.output,
			"-W",
			"--stik", "Short Film"
		];
		function add(key, value) {
			if (value) {
				args.push("--" + key);
				args.push(value);
			}
		}
		function addCustom(key, value) {
			if (value) {
				args.push("--rDNSatom");
				args.push(value);
				args.push("name=" + key);
				args.push("domain=com.apple.iTunes");
			}
		}
		add("title", info.title);
		add("artist", _director(info));
		add("genre", _genre(info));
		add("year", info.date ? info.date : info.year);
		add("description", info.description);
		add("longdesc", info.description);
		add("contentRating", info.rating);
		if (self.quality >= 22) add("hdvideo", "true");
		addCustom("iTunMOVI", _castList(info));

		function exec(callback) {
			var child = child_process.spawn(config.atomicparsley, args, { stdio: "inherit" });
			child.on("exit", function (code) {
				if (callback) callback();
			});
		}

		if (info.image) {
			var tmp = "/tmp/dvdripper~" + path.basename(info.image);
			add("artwork", "REMOVE_ALL");
			add("artwork", tmp);
			var req = request(info.image);
			req.pipe(fs.createWriteStream(tmp));
			req.on("end", function () {
				exec(function () {
					fs.unlink(tmp, callback);
				});
			});
		} else {
			exec(callback);
		}

	};

	// eject the disk
	self.eject = function (callback) {
		var command = config.eject + " /dev/disk1";
		child_process.exec(command, function (error, stdout, stderr) {
			if (callback) callback();
		});
	};

	// automatic execution
	self.run = function run(callback) {
		self.loadCache(function (success) {
			var rip = self.rip.bind(self, function () {
				self.eject(function () {
					self.writeMetadata(callback);
				});
			});
			if (success) {
				rip();
			} else {
				self.identify(function () {
					self.scan(function (success) {
						if (success) {
							cache.save(self.input, self.info);
							rip();
						} else {
							if (callback) callback();
						}
					});
				});
			}
		});
	};
}

module.exports = Ripper;
