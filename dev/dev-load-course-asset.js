'use strict';

const yaml = require('js-yaml');
const loadCourseAsset = require('../src/main/load-course-asset');
const LEVEL_SCHEMA = require('./level-config-schema').LEVEL_CONFIG_SCHEMA;

class DevLoaderPair extends loadCourseAsset.LoaderPair {

    /**
     * 
     * @param {AssetLoader} globalLoader 
     * @param {AssetLoader} courseLoader 
     */
    constructor(globalLoader, courseLoader) {
        super(globalLoader, courseLoader);
    }

    loadLevelFromCourse(levelName, courseName) {
        let loader = this.getCourseLoader(courseName);

        return loader.loadTextContent(levelName)
        .then(text => {
            console.log(`loading ${levelName} json`);
            return yaml.safeLoad(text, { schema: LEVEL_SCHEMA });
        });            
    }
}

module.exports = Object.assign(module.exports, loadCourseAsset);
module.exports.createCourseAssetLoaderPair = (courseSettings) => {
    let loaderPair = loadCourseAsset.createCourseAssetLoaderPair(
        courseSettings
    );
    return new DevLoaderPair(loaderPair.global, loaderPair.course);
};