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

    getGlobalLoader(language) {
        return this.global.getLoaderForBundlePath(language);
    }

    getCourseLoader(courseName, language) {
        return this.course.getLoaderForBundlePath(courseName, language);
    }

    /**
     * 
     * @param {string} courseName 
     * @param {string} language The language code of loaded course
     * @returns {Promise} A promise that yields CourseConfig
     */
    loadCourse(courseName, language) {
        return this.loadCourseRaw(courseName, language)
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
    loadCourseRaw(courseName, language) {
        let loader = this.getGlobalLoader(language);

        return loader.loadTextContent(this.assetNameToId.course(courseName));        
    }

    /**
     * 
     * @param {string} stringKey 
     * @param {string} language The language code of loaded course
     * @returns {Promise} A promise that yields string content for common use
     */
    loadCommonString(stringKey, language) {
        return this.getGlobalLoader(
            language
        ).loadTextContent(
            this.assetNameToId.courseRenderAsset(stringKey)
        );
    }

    /**
     * 
     * @param {string} key 
     * @param {string} language The language code of loaded course
     * @returns {Promise} A promise that yields full path to a common asset
     */
    loadCommonAssetPath(key, language) {
        return this.getGlobalLoader(
            language
        ).getFullAssetPath(
            this.assetNameToId.commonAsset(key)
        );
    }

    /**
     * 
     * @param {string} levelName 
     * @param {string} courseName 
     * @param {string} language The language code of loaded course
     * @returns {Promise} A promise that yields LevelConfig
     */
    loadLevelFromCourse(levelName, courseName, language) {
        let loader = this.getCourseLoader(courseName, language);

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
     * @param {string} language The language code of loaded course
     * @returns {Promise} A promise that yields string content for course content
     */
    loadCourseText(stringKey, courseName, language) {
        let loader = this.getCourseLoader(courseName, language);

        return loader.loadTextContent(stringKey);
    }

    /**
     * 
     * @param {string} repoName
     * @param {string} courseName
     * @param {string} language The language code of loaded course
     * @returns {Promise} A promise that yields string content for course content
     */
    loadRepoArchivePath(repoName, courseName, language) {
        let loader = this.getCourseLoader(courseName, language);

        return loader.getFullAssetPath(this.assetNameToId.repoArchive(repoName));
    }
}

/**
 * 
 * @param {CourseStruct} courseStruct
 * @returns {LoaderPair}
 */
function createCourseAssetLoaderPair(courseStruct) {
    let globalLoader = new AssetLoader(courseStruct.resourcesPath);
    let courseLoader = new AssetLoader(courseStruct.courseResourcesPath);

    return new LoaderPair(globalLoader, courseLoader);
}

module.exports.CourseAssetNameToId = CourseAssetNameToId;
module.exports.LoaderPair = LoaderPair;
module.exports.createCourseAssetLoaderPair = createCourseAssetLoaderPair;