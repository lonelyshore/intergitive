'use strict';

const yaml = require('js-yaml');

const AssetLoader = require('./asset-loader').AssetLoader;
const RuntimeCourseSettings = require('./runtime-course-settings');
const levelSchema = require('../common/level-config-schema').LEVEL_CONFIG_SCHEMA;
const courseSchema = require('../common/course-config-schema').COURSE_CONFIG_SCHEMA;

class CourseAssetNameToId {
    course(courseName) {
        return `course/${courseName}`;
    }

    courseRenderAsset(stringKey) {
        return `render/${stringKey}`;
    }

    commonAsset(key) {
        return `common/${key}`
    }

    repoArchive(repoName) {
        return `archives/${repoName}`;
    }
}

class LoaderPair {
    /**
     * 
     * @param {AssetLoader} globalLoader 
     * @param {AssetLoader} courseLoader 
     */
    constructor(globalLoader, courseLoader) {
        this.global = globalLoader;
        this.course = courseLoader;

        this.assetNameToId = new CourseAssetNameToId();
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
        return this.loadCourseRaw(courseName)
        .then(content => {
            console.log(`loading ${courseName} json`);
            return yaml.safeLoad(content, { schema: courseSchema});
        });            
    }

    /**
     * 
     * @param {string} courseName 
     * @returns {Promise} A promise that yields CourseConfig
     */
    loadCourseRaw(courseName) {
        let loader = this.global;

        return loader.loadTextContent(this.assetNameToId.course(courseName));        
    }

    /**
     * 
     * @param {string} stringKey 
     * @returns {Promise} A promise that yields string content for common use
     */
    loadCommonString(stringKey) {
        return this.global.loadTextContent(this.assetNameToId.courseRenderAsset(stringKey));
    }

    /**
     * 
     * @param {string} key 
     * @returns {Promise} A promise that yields full path to a common asset
     */
    loadCommonAssetPath(key) {
        return this.global.getFullAssetPath(this.assetNameToId.commonAsset(key));
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

        return loader.getFullAssetPath(this.assetNameToId.repoArchive(repoName));
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

module.exports.CourseAssetNameToId = CourseAssetNameToId;
module.exports.LoaderPair = LoaderPair;
module.exports.createCourseAssetLoaderPair = createCourseAssetLoaderPair;