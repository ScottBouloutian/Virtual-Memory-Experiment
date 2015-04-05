// Scott Bouloutian

var ffmpeg = require('ffmpeg'),
    mkdirp = require('mkdirp'),
    sleep = require('sleep');

var fs = require('fs');

// Module to facilitate tracking of machine statistics
var statsTracker = require('./statsTracker');

// Configuration
var inputFile = 'video_input.ogg', // Path to a large video file
    controlSamples = 1, // The number of control samples to gather before a test
    outputFolder = 'output'; // The folder in which to save generated files

// Begin the virtual memory tests
console.log('Welcome to this virtual memory testing script!');

// Make sure the output folder doesn't already exist
if (fs.existsSync(outputFolder)) {
    console.log('Output folder already exists, please remove it before continuing.');
    process.exit(1);
}

// Gather control samples before the test
console.log('Getting ' + controlSamples + ' control samples...');
statsTracker.getSamples(controlSamples, 1000, function(err, samples) {

    // Output the control samples
    console.log('Control Samples:');
    console.log(samples);

    // Begin the test
    console.log('Converting the video file...');
    statsTracker.startTracking(1000);
    convertVideo(inputFile, 'bunny_10.mov', function(err) {
        var samples = statsTracker.stopTracking();
        if (err) {
            console.log(err);
            process.exit(1);
        } else {
            // The video conversion has successfully completed
            console.log('Video conversion completed successfully!');

            // Output the samples taken during the test
            console.log('Test Samples:');
            console.log(samples);
        }
    });

});

// Converts a video file to a mov file format
function convertVideo(inputFilePath, outputFileName, callback) {
    var outputFilePath = outputFolder + '/' + outputFileName;
    // Create the output folder
    mkdirp(outputFolder, function(err) {
        if (err) {
            callback(err);
        } else {
            var convert_process = new ffmpeg(inputFilePath);
            convert_process.then(function(video) {
                video.setVideoDuration(10)
                video.setVideoFormat('mov')
                video.setVideoCodec('h264')
                video.setAudioCodec('mp3')
                    .save(outputFilePath, function(error, file) {
                        if (!error) {
                            callback(null);
                        }
                    });
            }, function(err) {
                callback(err);
            });
        }
    });
}
