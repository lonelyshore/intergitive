'use strict';
const path = require('path');
const CourseStruct = require('./course-struct');

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
     */
    constructor(projectPath, serializedCourseSettings) {
        super(path.join(projectPath, serializedCourseSettings.relativeBasePath));
        this.projectPath = projectPath;
        this.serializedSettings = serializedCourseSettings;
    }

    get bundlePath() {
        return this.serializedSettings.bundlePaths;
    }

    get repoStoreCollectionName() {
        return 'repo-stores';
    }

    get course() {
        return this.serializedSettings.selectedCourse;
    }
}


module.exports = RuntimeCourseSettings;