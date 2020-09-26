"use strict";

/**
 * @callback LevelCb
 * @param {LevelItem} levelItem
 */

 /**
  * @callback SequentialSectionItemCb
  * @param {SequentialSectionItem} sequentialSectionItem
  */

/**
 * @callback FreeAccessSectionItemCb
 * @param {FreeAccessSectionItem} freeAccessSectionItem
 */

/**
 * @callback CourseItemCb
 * @param {Course} course
 */

class CourseItemVisitor {
    /**
     * 
     * @param {LevelCb} visitLevelItem 
     * @param {SequentialSectionItemCb} visitSequentialSectionItem 
     * @param {FreeAccessSectionItemCb} visitFreeAccessSectionItem 
     * @param {CourseItemCb} visitCourse 
     */
    constructor(
        visitLevelItem,
        visitSequentialSectionItem,
        visitFreeAccessSectionItem,
        visitCourse
    ) {
        this.visitLevelItem = 
            visitLevelItem || this.notDefined('visitLevelItem');
        this.visitSequentialSectionItem =
            visitSequentialSectionItem || this.notDefined('visitSequentialSelectionItem');
        this.visitFreeAccessSectionItem =
            visitFreeAccessSectionItem || this.notDefined('visitFreeAccessSelectionItem');
        this.visitCourse =
            visitCourse || this.notDefined('visitCourse');
    }

    notDefined(functionName) {
        throw new Error(`${functionName} not defined`);
    }
}

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

    /**
     * 
     * @param {CourseItemVisitor} visitor 
     */
    accept(visitor) {
        return visitor.visitLevelItem(this);
    }
}

class SequentialSectionItem extends NestedNamedCourseItem {
    constructor(id, nameKey, prerequisiteIds, children) {
        super(id, nameKey, prerequisiteIds, children);
    }

    get renderComponent() {
        return 'sequential-section';
    }

    /**
     * 
     * @param {CourseItemVisitor} visitor 
     */
    accept(visitor) {
        return visitor.visitSequentialSectionItem(this);
    }
}

class FreeAccessSectionItem extends NestedNamedCourseItem {
    constructor(id, nameKey, prerequisiteIds, children) {
        super(id, nameKey, prerequisiteIds, children);
    }

    get renderComponent() {
        return 'free-access-section';
    }

    /**
     * 
     * @param {CourseItemVisitor} visitor 
     */
    accept(visitor) {
        return visitor.visitFreeAccessSectionItem(this);
    }    
}

class Course extends NestedNamedCourseItem {
    constructor(id, nameKey, children) {
        super(id, nameKey, [], children);
    }

    get renderComponent() {
        return 'course';
    }

    /**
     * 
     * @param {CourseItemVisitor} visitor 
     */
    accept(visitor) {
        return visitor.visitCourse(this);
    }
}

/**
 * Flatten course tree
 * @param {NamedCourseItem} courseTree 
 * @returns {Array<NamedCourseItem>} flatCourseSeries
 */
function flattenCourseTree(courseTree) {
    let ret = [];
    
    flattenCourseTreeInternal(courseTree, ret);

    return ret;
}

function flattenCourseTreeInternal(item, flatCourseSeries) {
    if ('children' in item) {
        item.children.forEach(child => {
            flattenCourseTreeInternal(child, flatCourseSeries);
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
    return findLastLevelFromId(flatCourseItems, currentLevel.id);
}

/**
 * Given ID of current level, find last level item.
 * Will be null when not found.
 * @param {Array<NamedCourseItem>} flatCourseItems 
 * @param {string} currentLevel 
 * @returns {LevelItem}
 */
function findLastLevelFromId(flatCourseItems, currentLevelId) {
    let currentLevelIndex = flatCourseItems.findIndex(
        level => level.id === currentLevelId
    );
    
    for (let i = currentLevelIndex - 1; i >= 0; i--) {
        let candidateLevel = flatCourseItems[i];
        if (candidateLevel instanceof LevelItem) {
            return candidateLevel;
        }
    }

    return null;
}

/**
 * 
 * @param {NestedNamedCourseItem} courseTree 
 * @param {String} id 
 * @returns {NamedCourseItem}
 */
function findItemWithId(courseTree, id) {
    function findItemWithIdRecursive(current, id) {
        if (current.id === id) {
            return current;
        }
        else if (current.children){
            let result = null;
            current.children.forEach(child => {
                let childResult = findItemWithIdRecursive(child, id);
                if (childResult !== null) {
                    result = null;
                }
            });

            return result;
        }
        else {
            return null;
        }
    }

    return findItemWithIdRecursive(courseTree, id);
}

module.exports.NamedCourseItem = NamedCourseItem;
module.exports.NestedNamedCourseItem = NestedNamedCourseItem;
module.exports.LevelItem = LevelItem;
module.exports.SequentialSectionItem = SequentialSectionItem;
module.exports.FreeAccessSectionItem = FreeAccessSectionItem;
module.exports.Course = Course;
module.exports.flattenCourseTree = flattenCourseTree;
module.exports.findLastLevel = findLastLevel;
module.exports.findLastLevelFromId = findLastLevelFromId;
module.exports.findItemWithId = findItemWithId;
module.exports.CourseItemVisitor = CourseItemVisitor;