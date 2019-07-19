const path = require('path');
const runAndTestBasePath = path.resolve(__dirname, './example');

const runAndTest = {
    RESOURCES_PATH: path.join(runAndTestBasePath, 'resources'),
    BUNDLE_PATH: [],
    STATIC_PATH: path.join(path.relative(__dirname, runAndTestBasePath), 'static'),
    PLAYGROUND_PATH: path.join(runAndTestBasePath, 'playground'),
    REPO_STORE_COLLECTION_NAME: 'repo-stores',
    REF_STORE_NAME: 'reference-store',
    CHECKPOINT_STORE_NAME: 'checkpoint-store',
};

const result = runAndTest;

module.exports.RESOURCES_PATH = result.RESOURCES_PATH;
module.exports.BUNDLE_PATH = result.BUNDLE_PATH;
module.exports.STATIC_PATH = result.STATIC_PATH;
module.exports.PLAYGROUND_PATH = result.PLAYGROUND_PATH;
module.exports.REPO_STORE_COLLECTION_NAME = result.REPO_STORE_COLLECTION_NAME;
module.exports.REF_STORE_NAME = result.REF_STORE_NAME;
module.exports.CHECKPOINT_STORE_NAME = result.CHECKPOINT_STORE_NAME;