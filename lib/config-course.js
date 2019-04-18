"use strict";

class NamedCourseItem {
    constructor(id, nameKey) {
        this.id = id;
        this.nameKey = nameKey;
    }
}

class LevelItem extends NamedCourseItem {
    constructor(id, nameKey, configPath) {
        super(id, nameKey);

        this.configPath = configPath;
    }
}

class HasPrerequisiteWrappingItem {
    constructor(prerequisites, wrappedItem) {
        super();
        this.prerequisites = prerequisites;
        this.wrappedItem = wrappedItem;
    }
}

class SectionItem extends NamedCourseItem {
    constructor(id, nameKey, sequentialChildren, hasPrerequisiteChildren) {
        super();
        this.id = id;
        this.nameKey = nameKey;
        this.sequentialChildren = sequentialChildren;
        this.hasPrerequisiteChildren = hasPrerequisiteChildren;
    }
}

module.exports.NamedCourseItem = NamedCourseItem;
module.exports.LevelItem = LevelItem;
module.exports.HasPrerequisiteWrappingItem = HasPrerequisiteWrappingItem;
module.exports.SectionItem = SectionItem;
