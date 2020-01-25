const path = require('path');
const CourseStruct = require('./course-struct');

class RuntimeCourseSettings extends CourseStruct {

    constructor(projectPath, relativeBasePath) {
        super(path.join(projectPath, relativeBasePath));
        this.projectPath = projectPath;
    }

    get bundlePath() {
        return [];
    }

    get repoStoreCollectionName() {
        return 'repo-stores';
    }

    get course() {
        return 'demo';
    }
}

module.exports = RuntimeCourseSettings;