// Scott Bouloutian

var ffmpeg = require('ffmpeg'),
    mkdirp = require('mkdirp'),
    sleep = require('sleep'),
    Q = require('q'),
    table = require('text-table'),
    exec = require('child_process').exec;


var fs = require('fs');

// Module to facilitate tracking of machine statistics
var statsTracker = require('./statsTracker');

// Configuration
var inputFile = "/media/SCOTT_DRIVE/input.ogg", // Path to a large video file
    controlSamples = 5, // The number of control samples to gather before a test
    outputFolder = '/media/SCOTT_DRIVE/output', // The folder in which to save generated files
    dataFile = 'stats.txt'; // The file in which to write test results

// Begin the virtual memory tests
console.log('Welcome to this virtual memory testing script!');

// Make sure the output folder doesn't already exist
if (fs.existsSync(outputFolder)) {
    console.log('Output folder already exists, please remove it before continuing.');
    process.exit(1);
}

// Run the testing suite
Q.nfcall(mkdirp, outputFolder)
    .then(function() {
        return getControlSamples();
    })
    .then(function(samples) {
        return outputSamples(samples, 'Control Samples For 6 Second Conversion:');
    })
    .then(function() {
        return startVideoConvertTest(6);
    })
    .then(function(samples) {
        return outputSamples(samples, 'Test Samples For 6 Second Conversion:');
    })
    .then(function() {
        return getControlSamples();
    })
    .then(function(samples) {
        return outputSamples(samples, 'Control Samples For 60 Second Conversion');
    })
    .then(function() {
        return startVideoConvertTest(60);
    })
    .then(function(samples) {
        return outputSamples(samples, 'Test Samples For 60 Second Conversion:');
    })
    .then(function() {
        return getControlSamples();
    })
    .then(function(samples) {
        return outputSamples(samples, 'Control Samples For 600 Second Conversion');
    })
    .then(function() {
        return startVideoConvertTest(600);
    })
    .then(function(samples) {
        return outputSamples(samples, 'Test Samples For 600 Second Conversion:');
    })
    .then(function() {
        return getControlSamples();
    })
    .then(function(samples) {
        return outputSamples(samples, 'Control Samples For Parallel 6 and 60 Second Conversion:');
    })
    .then(function() {
        return startParallelConvertTest(6, 60, '1');
    })
    .then(function(samples) {
        return outputSamples(samples, 'Test Samples For Parallel 6 and 60 Second Conversion:');
    })
    .then(function() {
        return getControlSamples();
    })
    .then(function(samples) {
        return outputSamples(samples, 'Control Samples For Parallel 60 and 600 Second Conversion:');
    })
    .then(function() {
        return startParallelConvertTest(60, 600, '2');
    })
    .then(function(samples) {
        return outputSamples(samples, 'Test Samples For Parallel 60 and 600 Second Conversion:');
    })
    .catch(function(error) {
        statsTracker.stopTracking();
        console.log(error);
    });

// Gather control samples before a test
function getControlSamples() {
    console.log('Getting ' + controlSamples + ' control samples...');
    return statsTracker.getSamples(controlSamples, 1000);
}

// Writes a summary of the samples taken to a file
function outputSamples(samples, msg) {
    // Write a message describing the samples taken
    fs.appendFileSync(outputFolder + '/' + dataFile, msg + '\n\n');

    // Prepare the column headers
    var columnHeaders = statsTracker.measuredStats();
    columnHeaders.unshift('index');

    // Construct the table to be displayed
    var tableArray = [columnHeaders];

    // Add the samples to the table array
    samples.forEach(function(sample, index) {
        var row = [];
        row.push(index);
        statsTracker.measuredStats().forEach(function(stat) {
            row.push(sample[stat]);
        });
        tableArray.push(row);
    });
    // Render the table
    var t = table(tableArray, {
        align: function() {
            var result = [];
            columnHeaders.forEach(function() {
                result.push('r');
            });
            return result;
        }()
    });

    // Write the table to the file
    fs.appendFileSync(outputFolder + '/' + dataFile, t + '\n\n');
}

// Begins a video conversion test
// The test converts the first 'duration' seconds of the input video whilst measuring machine statistics
function startVideoConvertTest(duration) {
    console.log('Converting video file of length ' + duration + '...');
    statsTracker.startTracking(1000);
    var outputFileName = 'output_' + duration + '.mov';
    var outputFilePath = outputFolder + '/' + outputFileName;
    return convertVideo(inputFile, outputFilePath, duration)
        .then(function() {
            var samples = statsTracker.stopTracking();
            console.log('Video conversion completed successfully!');
            return samples;
        })
        .catch(function(error) {
            statsTracker.stopTracking();
            console.log(error);
        });
}

// Begins a test running two video conversions in parallel
function startParallelConvertTest(duration1, duration2, suffix) {
    var deferred = Q.defer();
    console.log('Converting video files in parallel of lengths ' + duration1 + ' and ' + duration2 + '...');
    var command1 = 'ffmpeg -i ' + inputFile + ' -f mov -vcodec h264 -t ' + duration1 + ' -acodec libmp3lame ' + outputFolder + '/parallel_' + duration1 + '_' + suffix + '.mov';
    var command2 = 'ffmpeg -i ' + inputFile + ' -f mov -vcodec h264 -t ' + duration2 + ' -acodec libmp3lame ' + outputFolder + '/parallel_' + duration2 + '_' + suffix + '.mov';
    var child1 = exec(command1);
    var child2 = exec(command2);
    var childRunning1 = true;
    var childRunning2 = true;
    statsTracker.startTracking(1000);
    var samples;
    child1.on('exit', function(code) {
        if (code === 0) {
            childRunning1 = false;
            if(!childRunning2) {
                deferred.reject();
            } else {
                samples = statsTracker.stopTracking();
            }
        } else {
            deferred.reject('child1 error');
        }
    });
    child2.on('exit', function(code) {
        if (code === 0) {
            childRunning2 = false;
            if(childRunning1) {
                deferred.reject();
            } else {
                deferred.resolve(samples);
            }
        } else {
            deferred.reject('child2 error');
        }
    });
    return deferred.promise;
}

// Converts a video file to a mov file format and returns a promise
function convertVideo(inputFilePath, outputFilePath, duration) {
    var deferred = Q.defer();
    var convert_process = new ffmpeg(inputFilePath);
    convert_process.then(function(video) {
            video.setVideoDuration(duration)
            video.setVideoFormat('mov')
            video.setVideoCodec('h264')
            video.setAudioCodec('mp3')
                .save(outputFilePath, function(error, file) {
                    if (error) {
                        deferred.reject(error);
                    }
                    deferred.resolve(file);
                });
        })
        .catch(function(error) {
            return deferred.reject(error);
        });
    return deferred.promise;
}
