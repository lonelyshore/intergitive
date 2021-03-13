'use strict';
const path = require('path');
const CourseStruct = require('./course-struct');
const { ApplicationConfig } = require('../common/config-app');

class RuntimeCourseSettings extends CourseStruct {

    /**
     * 
     * @param {string} runtimeBasePath
     * @param {ApplicationConfig} appConfig
     */
    constructor(runtimeBasePath, appConfig) {
        super(runtimeBasePath);
        this.appConfig = appConfig;
    }

    get language() {
        return this.appConfig.language;
    }

    get repoStoreCollectionName() {
        return 'repo-stores';
    }

    get course() {
        return this.appConfig.courseName;
    }
}


module.exports = RuntimeCourseSettings;