'use strict';
const path = require('path');
const CourseStruct = require('./course-struct');
const { ApplicationConfig } = require('../common/config-app');

class SerializedCourseSettings {
    constructor(
        relativeBasePath,
        bundlePaths,
        selectedCourse
    ) {
        this.relativeBasePath = relativeBasePath;
        this.bundlePaths = bundlePaths;
        this.selectedCourse = selectedCourse;
    }
}

class RuntimeCourseSettings extends CourseStruct {

    /**
     * 
     * @param {string} projectPath
     * @param {SerializedCourseSettings} serializedCourseSettings 
     * @param {ApplicationConfig} appConfig
     */
    constructor(projectPath, serializedCourseSettings, appConfig) {
        super(path.join(projectPath, serializedCourseSettings.relativeBasePath));
        this.projectPath = projectPath;
        this.serializedSettings = serializedCourseSettings;
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