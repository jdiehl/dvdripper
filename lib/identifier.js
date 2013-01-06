var config = require("../config.json");
var fs = require("fs");
var chainsaw = require("chainsaw");
var path = require("path");
var tmdb = require('tmdbv3').init(config.tmdb_key);
var discident = require("discident");

// Beautify a string
function _beautify(string) {
	var output = [];
	string.split(/[ _\-\.]/).forEach(function (word) {
		word = word[0].toUpperCase() + word.slice(1).toLowerCase();
		output.push(word);
	});
	return output.join(" ");
}

function identifier(m) {
    return chainsaw(function (saw) {

		// Get the beautified volume name
		this.queryVolume = function () {
			console.log("Querying volume...");
			var name = path.basename(m.input);
			name = _beautify(name);
			m.title = name;
			saw.next();
		};

		// Query discident.com
		this.queryDiscident = function () {
			console.log("Querying discident...");
			discident.identify(m.input, function (res) {
				if (res) {
					m.title = res.title;
					m.year = res.productionYear;
					m.discident = res;
				}
				saw.next();
			});
		};

		// Query TheMovieDB
		this.queryTMDB = function () {
			console.log("Querying TMDB...");
			tmdb.search.movie(m.title, { include_adult: false, year: m.year }, function (err, res) {
				if (res && res.results && res.results[0]) {
					var movie = res.results[0];
					m.title = movie.title;
					m.date = movie.release_date;
					m.image = movie.poster_path;
					m.tmdb = movie;
				}
				saw.next();
			});
		};

		// Query TheMovieDB Details
		this.queryTMDBDetails = function () {
			var id = m.tmdb.id;
			if (!id) {
				saw.next();
				return;
			}
			console.log("Querying TMDB Details...");
			tmdb.movie.info(id, function (err, res) {
				if (res) {
					m.title = res.title;
					m.date = res.release_date;
					m.image = res.poster_path;
					m.runtime = res.runtime;
					m.overview = res.overview;
					m.tmdb = res;
				}

				// get cast
				tmdb.movie.casts(id, function (err, res) {
					if (res.cast) {
						m.cast = res.cast;
					}
					saw.next();
				});
			});
		};

        this.do = function (cb) {
            saw.nest(cb, m);
        };
    });
}

module.exports = identifier;
