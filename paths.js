const path = require('path');
const readonly = require('./lib/readonly');
const runAndTestBasePath = path.resolve(__dirname, './example');

let baseSetting = {
    PROJECT_DIR: __dirname,
    RESOURCES_PATH: path.join(runAndTestBasePath, 'resources'),
    COURSE_RESOURCES_PATH: path.join(runAndTestBasePath, 'course-resources'),
    BUNDLE_PATH: [],
    PLAYGROUND_PATH: path.join(runAndTestBasePath, 'playground'),
    REPO_STORE_COLLECTION_NAME: 'repo-stores',
    COURSE: 'fork'
};

baseSetting = readonly.wrap(baseSetting);

module.exports = baseSetting;