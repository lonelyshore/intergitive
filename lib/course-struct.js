class CourseStruct {
    constructor(basePath) {
        this.basePath = basePath;
    }

    get resourcesPath() {
        return path.join(this.basePath, 'resources');
    }

    get courseResourcesPath() {
        return path.join(this.basePath, 'course-resources');
    }

    get playgroundPath() {
        return path.join(this.basePath, 'playground');
    }

    get repoStoreCollectionName() {
        return 'repo-stores';
    }
}

module.exports = CourseStruct;