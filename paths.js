const path = require('path');
const readonly = require('./lib/readonly');
const CourseStruct = require('./lib/course-struct');


let exampleStruct = new CourseStruct('./example');

let baseSetting = {
    BASE_PATH: exampleStruct.basePath,
    PROJECT_DIR: __dirname,
    RESOURCES_PATH: exampleStruct.resourcesPath,
    COURSE_RESOURCES_PATH: exampleStruct.courseResourcesPath,
    BUNDLE_PATH: [],
    PLAYGROUND_PATH: exampleStruct.playgroundPath,
    REPO_STORE_COLLECTION_NAME: exampleStruct.repoStoreCollectionName,
    COURSE: 'fork'
};

baseSetting = readonly.wrap(baseSetting);

module.exports = baseSetting;