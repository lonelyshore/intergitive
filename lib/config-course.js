"use strict";

class NamedCourseItem {
    constructor(id, nameKey, prerequisiteIds) {
        this.id = id;
        this.nameKey = nameKey;
        this.prerequisiteIds = prerequisiteIds;
    }

    get renderComponent() {
        throw new Error('Not implemented');
    }
}

class NestedNamedCourseItem extends NamedCourseItem {
    constructor(id, nameKey, prerequisiteIds, children) {
        super(id, nameKey, prerequisiteIds);

        this.children = children;
    }
}

class LevelItem extends NamedCourseItem {
    constructor(id, nameKey, prerequisiteIds, configAssetId) {
        super(id, nameKey, prerequisiteIds);

        this.configAssetId = configAssetId;
    }

    get renderComponent() {
        return 'level';
    }
}

class SequentialSectionItem extends NestedNamedCourseItem {
    constructor(id, nameKey, prerequisiteIds, children) {
        super(id, nameKey, prerequisiteIds, children);
    }

    get renderComponent() {
        return 'sequential-section';
    }
}

class FreeAccessSectionItem extends NestedNamedCourseItem {
    constructor(id, nameKey, prerequisiteIds, children) {
        super(id, nameKey, prerequisiteIds, children);
    }

    get renderComponent() {
        return 'free-access-section';
    }
}

class Course extends NestedNamedCourseItem {
    constructor(id, nameKey, children) {
        super(id, nameKey, [], children);
    }

    get renderComponent() {
        return 'course';
    }
}

module.exports.NamedCourseItem = NamedCourseItem;
module.exports.LevelItem = LevelItem;
module.exports.SequentialSectionItem = SequentialSectionItem;
module.exports.FreeAccessSectionItem = FreeAccessSectionItem;
module.exports.Course = Course;
