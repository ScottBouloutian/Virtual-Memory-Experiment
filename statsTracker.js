require('array.prototype.find');

var Q = require('q');

var exec = require('child_process').exec;

var tracker;
var samples;

// Structure defining which statistics to collect
var stats = [{
    key: 'pages_free',
    search: 'Pages free'
}, {
    key: 'pages_active',
    search: 'Pages active'
}, {
    key: 'pages_inactive',
    search: 'Pages inactive'
}, {
    key: 'page_ins',
    search: 'Pageins'
}, {
    key: 'page_outs',
    search: 'Pageouts'
}, {
    key: 'swap_ins',
    search: 'Swapins'
}, {
    key: 'swap_outs',
    search: 'Swapouts'
}];

exports.measuredStats = function() {
    return stats.map(function(stat) {
        return stat.key;
    });
};

// Function to get 'n' samples with 'delay' ms in-between each one and return a promise
exports.getSamples = function(n, delay) {
    var samples = [];
    var promise = Q();
    for (var i = 0; i < n; i++) {
        promise = promise.then(function() {
            return getStats()
                .then(function(stats) {
                    samples.push(stats);
                    return Q.delay(delay);
                });
        });
    }
    return promise.then(function() {
        return samples;
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
            var sample = {};
            for (var i = 0; i < lines.length; i++) {
                // See if one of the stats we want to measure is in the output
                var stat = stats.find(function(stat) {
                    return (lines[i].substr(0, stat.search.length) === stat.search);
                });
                if(stat) {
                    var temp = lines[i].split(':');
                    var numStr = temp[1].substr(0, temp[1].length - 1).trim();
                    sample[stat.key] = parseInt(numStr)
                }
            }
            return sample;
        });
}
