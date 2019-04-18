"use strict";

class AbstractCourseItem {
    constructor() {}
}

class NamedCourseItem extends AbstractCourseItem {
    constructor(id, nameKey) {
        super();
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

class NeedPrerequisiteWrappingItem extends AbstractCourseItem {
    constructor(prerequisites, wrappedItem) {
        super();
        this.prerequisites = prerequisites;
        this.wrappedItem = wrappedItem;
    }
}

class SectionItem extends NamedCourseItem {
    constructor(id, nameKey, sequentialChildren, needPrerequisiteChildren) {
        super();
        this.id = id;
        this.nameKey = nameKey;
        this.sequentialChildren = sequentialChildren;
        this.needPrerequisiteChildren = needPrerequisiteChildren;
    }
}

module.exports.NamedCourseItem = NamedCourseItem;
module.exports.LevelItem = LevelItem;
module.exports.NeedPrerequisiteWrappingItem = NeedPrerequisiteWrappingItem;
module.exports.SectionItem = SectionItem;
