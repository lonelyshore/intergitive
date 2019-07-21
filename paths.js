const path = require('path');
const readonly = require('./lib/readonly');
const runAndTestBasePath = path.resolve(__dirname, './example');

let baseSetting = {
    RESOURCES_PATH: path.join(runAndTestBasePath, 'resources'),
    BUNDLE_PATH: [],
    STATIC_PATH: path.join(path.relative(__dirname, runAndTestBasePath), 'static'),
    PLAYGROUND_PATH: path.join(runAndTestBasePath, 'playground'),
    REPO_STORE_COLLECTION_NAME: 'repo-stores',
};

baseSetting = readonly.wrap(baseSetting);

exports = module.exports = baseSetting;