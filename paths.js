const path = require('path');
const runAndTestBasePath = path.resolve(__dirname, './example');

const runAndTest = {
    RESOURCES_PATH: path.join(runAndTestBasePath, 'resources'),
    BUNDLE_PATH: [],
    STATIC_PATH: path.join(path.relative(__dirname, runAndTestBasePath), 'static'),
    PLAYGROUND_PATH: path.join(runAndTestBasePath, 'playground'),
    REF_STORE_PATH: path.join(runAndTestBasePath, 'repoStore', 'refs'),
    CHECKPOINT_STORE_PATH: path.join(runAndTestBasePath, 'repoStore', 'checkpoints')
};

const result = runAndTest;

module.exports.RESOURCES_PATH = result.RESOURCES_PATH;
module.exports.BUNDLE_PATH = result.BUNDLE_PATH;
module.exports.STATIC_PATH = result.STATIC_PATH;
module.exports.PLAYGROUND_PATH = result.PLAYGROUND_PATH;
module.exports.REF_STORE_PATH = result.REF_STORE_PATH;
module.exports.CHECKPOINT_STORE_PATH = result.CHECKPOINT_STORE_PATH;