const yaml = require('js-yaml');

const AssetLoader = require('./asset-loader').AssetLoader;
const CourseStruct = require('./course-struct');
const RuntimeCourseSettings = require('./runtime-course-settings');
const levelSchema = require('./level-config-schema').LEVEL_CONFIG_SCHEMA;
const courseSchema = require('./course-config-schema').COURSE_CONFIG_SCHEMA;

class LoaderPair {
    /**
     * 
     * @param {AssetLoader} globalLoader 
     * @param {AssetLoader} courseLoader 
     */
    constructor(globalLoader, courseLoader) {
        this.global = globalLoader;
        this.course = courseLoader;
    }
}

/**
 * 
 * @param {RuntimeCourseSettings} courseSettings
 * @returns {LoaderPair}
 */
function createCourseAssetLoaderPair(courseSettings) {
    let globalLoader = new AssetLoader(courseSettings.resourcesPath);
    globalLoader.setBundlePath(...courseSettings.bundlePath);

    let courseLoader = new AssetLoader(courseSettings.courseResourcesPath);

    return new LoaderPair(globalLoader, courseLoader);
}

/**
 * 
 * @param {string} courseName 
 * @param {LoaderPair} loaderPair
 * @returns {Promise} A promise that yields CourseConfig
 */
function loadCourse(courseName, loaderPair) {
    let loader = loaderPair.global;

    return loader.loadTextContent(`course/${courseName}`)
    .then(content => {
        console.log(`loading ${courseName} json`);
        return yaml.safeLoad(content, { schema: courseSchema});
    });            
}

/**
 * 
 * @param {string} stringKey 
 * @param {LoaderPair} loaderPair 
 * @returns {Promise} A promise that yields string content for common use
 */
function loadCommonString(stringKey, loaderPair) {
    return loaderPair.global.loadTextContent(`render/${stringKey}`);
}

/**
 * 
 * @param {string} key 
 * @param {LoaderPair} loaderPair 
 * @returns {Promise} A promise that yields full path to a common asset
 */
function loadCommonAssetPath(key, loaderPair) {
    return loaderPair.global.getFullAssetPath(`common/${key}`);
}

/**
 * 
 * @param {string} levelName 
 * @param {string} courseName 
 * @param {LoaderPair} loaderPair
 * @returns {Promise} A promise that yields LevelConfig
 */
function loadLevelFromCourse(levelName, courseName, loaderPair) {
    let loader = loaderPair.course;
    loader.setBundlePath(courseName);

    return loader.loadTextContent(levelName)
    .then(text => {
        console.log(`loading ${levelName} json`);
        return yaml.safeLoad(text, { schema: levelSchema });
    });            
}


module.exports.LoaderPair = LoaderPair;
module.exports.createCourseAssetLoaderPair = createCourseAssetLoaderPair;
module.exports.loadCourse = loadCourse;
module.exports.loadCommonString = loadCommonString;
module.exports.loadCommonAssetPath = loadCommonAssetPath;
module.exports.loadLevelFromCourse = loadLevelFromCourse;