var Q = require('q');

var exec = require('child_process').exec;

var currentlyTracking = false;
var tracker;
var samples;

// Function to get 'n' samples with 'delay' ms in-between each one
exports.getSamples = function(n, delay, callback) {
    var samples = [];
    var promise = Q();
    for(var i=0;i<n;i++) {
        promise = promise.then(function() {
            return getStats()
                .then(function(stats) {
                    samples.push(stats);
                    return Q.delay(delay);
                });
        });
    }
    promise.then(function() {
        callback(null, samples);
    });
};

// Starts gathering samples with 'delay' ms in-between each one
exports.startTracking = function(delay) {
    samples = [];
    tracker = setInterval(function() {
        getStats().then(function(stats) {
            samples.push(stats);
        });
    }, delay);
};

// Stops gathering samples and returns the ones that have been gathered up to this point
exports.stopTracking = function() {
    clearInterval(tracker);
    return samples;
};

// Retreives machine statistics and returns a promise
function getStats() {
    return Q.nfcall(exec, 'vm_stat')
        .then(function(results) {
            var stdout = results[0];
            var lines = stdout.split('\n');
            var search = 'Pages free'
            var stats = {};
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].substr(0, search.length) === search) {
                    var temp = lines[i].split(':');
                    var numStr = temp[1].substr(0, temp[1].length - 1).trim();
                    stats.pages_free = parseInt(numStr)
                    break;
                };
            }
            return stats;
        });
}
