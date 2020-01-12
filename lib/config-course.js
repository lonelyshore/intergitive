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

/**
 * Flatten course tree
 * @param {NamedCourseItem} item 
 * @param {Array<string>} flatCourseSeries
 */
function flattenCourseTree(item, flatCourseSeries) {
    flatCourseSeries = flatCourseSeries || [];
    
    if ('children' in item) {
        item.children.forEach(child => {
            flattenCourseTree(child, flatCourseSeries);
        });
    }
    
    flatCourseSeries.push(item);
}

/**
 * Given current level, find last level item.
 * Will be null when not found.
 * @param {Array<NamedCourseItem>} flatCourseItems 
 * @param {LevelItem} currentLevel 
 * @returns {LevelItem}
 */
function findLastLevel(flatCourseItems, currentLevel) {
    for (let i = flatCourseItems.indexOf(currentLevel) - 1; i >= 0; i--) {
        let candidateLevel = flatCourseItems[i];
        if (candidateLevel instanceof LevelItem) {
            return candidateLevel;
        }
    }

    return null;
}

module.exports.NamedCourseItem = NamedCourseItem;
module.exports.NestedNamedCourseItem = NestedNamedCourseItem;
module.exports.LevelItem = LevelItem;
module.exports.SequentialSectionItem = SequentialSectionItem;
module.exports.FreeAccessSectionItem = FreeAccessSectionItem;
module.exports.Course = Course;
module.exports.flattenCourseTree = flattenCourseTree;
module.exports.findLastLevel = findLastLevel;