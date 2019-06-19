const path = require('path');
const runAndTestBasePath = path.resolve(__dirname, './example');

const runAndTest = {
    RESOURCES_PATH: path.join(runAndTestBasePath, "resources"),
    BUNDLE_PATH: [],
    STATIC_PATH: path.join(path.relative(__dirname, runAndTestBasePath), 'static'),
};

const result = runAndTest;

module.exports.RESOURCES_PATH = result.RESOURCES_PATH;
module.exports.BUNDLE_PATH = result.BUNDLE_PATH;
module.exports.STATIC_PATH = result.STATIC_PATH;