"use strict";

class NamedCourseItem {
    constructor(id, nameKey, prerequisiteIds) {
        this.id = id;
        this.nameKey = nameKey;
        this.prerequisiteIds = prerequisiteIds;
    }
}

class LevelItem extends NamedCourseItem {
    constructor(id, nameKey, prerequisiteIds, configAssetId) {
        super(id, nameKey, prerequisiteIds);

        this.configAssetId = configAssetId;
    }
}

class SectionItem extends NamedCourseItem {
    constructor(id, nameKey, prerequisiteIds, sequentialChildren, hasPrerequisiteChildren) {
        super(id, nameKey, prerequisiteIds);

        this.sequentialChildren = sequentialChildren;
        this.hasPrerequisiteChildren = hasPrerequisiteChildren;
    }
}

class Course {
    constructor(id, items) {
        this.id = id;
        this.items = items;
    }
}

module.exports.NamedCourseItem = NamedCourseItem;
module.exports.LevelItem = LevelItem;
module.exports.SectionItem = SectionItem;
module.exports.Course = Course;
