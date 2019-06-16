const path = require('path');
const runAndTestBasePath = path.resolve(__dirname, './playground');

const runAndTest = {
    RESOURCES_PATH: path.join(runAndTestBasePath, "resources"),
    BUNDLE_PATH: [],
};

const result = runAndTest;

module.exports.RESOURCES_PATH = result.RESOURCES_PATH;
module.exports.BUNDLE_PATH = result.BUNDLE_PATH;