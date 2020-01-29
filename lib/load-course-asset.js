'use strict';

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

    getCourseLoader(courseName) {
        return this.course.getLoaderForBundlePath(courseName);
    }

    /**
     * 
     * @param {string} courseName 
     * @returns {Promise} A promise that yields CourseConfig
     */
    loadCourse(courseName) {
        let loader = this.global;

        return loader.loadTextContent(`course/${courseName}`)
        .then(content => {
            console.log(`loading ${courseName} json`);
            return yaml.safeLoad(content, { schema: courseSchema});
        });            
    }

    /**
     * 
     * @param {string} stringKey 
     * @returns {Promise} A promise that yields string content for common use
     */
    loadCommonString(stringKey) {
        return this.global.loadTextContent(`render/${stringKey}`);
    }

    /**
     * 
     * @param {string} key 
     * @returns {Promise} A promise that yields full path to a common asset
     */
    loadCommonAssetPath(key) {
        return this.global.getFullAssetPath(`common/${key}`);
    }

    /**
     * 
     * @param {string} levelName 
     * @param {string} courseName 
     * @returns {Promise} A promise that yields LevelConfig
     */
    loadLevelFromCourse(levelName, courseName) {
        let loader = this.getCourseLoader(courseName);

        return loader.loadTextContent(levelName)
        .then(text => {
            console.log(`loading ${levelName} json`);
            return yaml.safeLoad(text, { schema: levelSchema });
        });            
    }

    /**
     * 
     * @param {string} stringKey
     * @param {string} courseName
     * @returns {Promise} A promise that yields string content for course content
     */
    loadCourseText(stringKey, courseName) {
        let loader = this.getCourseLoader(courseName);

        return loader.loadTextContent(stringKey);
    }

    loadRepoArchivePath(repoName, courseName) {
        let loader = this.getCourseLoader(courseName);

        return loader.getFullAssetPath(`archives/${repoName}`);
    }
}

/**
 * 
 * @param {RuntimeCourseSettings} courseSettings
 * @returns {LoaderPair}
 */
function createCourseAssetLoaderPair(courseSettings) {
    let globalLoader = new AssetLoader(courseSettings.resourcesPath, ...courseSettings.bundlePath);
    let courseLoader = new AssetLoader(courseSettings.courseResourcesPath);

    return new LoaderPair(globalLoader, courseLoader);
}

module.exports.LoaderPair = LoaderPair;
module.exports.createCourseAssetLoaderPair = createCourseAssetLoaderPair;