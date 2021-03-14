'use strict';
const path = require('path');

class CourseStruct {
    constructor(basePath) {
        this.basePath = basePath
    }

    get resourcesPath() {
        return path.join(this.basePath, 'resources');
    }

    get courseResourcesPath() {
        return path.join(this.basePath, 'course-resources');
    }

    get executionPath() {
        return path.join(this.basePath, 'execution');
    }

    get playgroundPath() {
        return path.join(this.executionPath, 'playground');
    }

    get progressPath() {
        return path.join(this.executionPath, 'progress');
    }

    get repoStoreCollectionName() {
        return 'repo-stores';
    }
}

module.exports = CourseStruct;