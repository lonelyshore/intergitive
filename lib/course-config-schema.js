'use strict';

const yaml = require('js-yaml');
const course = require('./config-course');

const isString = function(obj) {
    return typeof obj === 'string' || obj instanceof String;
}

let levelType = new yaml.Type('!level', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && 'id' in data
            && isString(data.id)
            && 'nameKey' in data
            && isString(data.nameKey)
            && 'configAssetId' in data
            && isString(data.configPath)
            && (
                !('prerequisiteIds' in data)
                || (
                    Array.isArray(data.prerequisiteIds)
                    && data.prerequisiteIds.all(p => isString(p))
                )
            );
    },

    construct: function(data) {
        return new course.LevelItem(
            data.id,
            data.nameKey,
            data.prerequisiteIds || [],
            data.configAssetId
        );
    },

    instanceOf: course.LevelItem,

    represent: function(item) {
        return {
            id: item.id,
            nameKey: item.nameKey,
            prerequisiteIds: item.prerequisiteIds,
            configPath: item.configAssetId
        };
    }
});

let sectionItemType = new yaml.Type('!section', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'id' in data
            && isString(data.id)
            && 'nameKey' in data
            && isString(data.nameKey)
            && (
                !('prerequisiteIds' in data)
                || (
                    Array.isArray(data.prerequisiteIds)
                    && data.prerequisiteIds.all(p => isString(p))
                )
            )
            && (
                !('sequentialChildren' in data)
                || (
                    Array.isArray(data.sequentialChildren)
                    && data.sequentialChildren.all(c => {
                        return c !== null && c instanceof course.NamedCourseItem;
                    })
                ) 
            )
            && (
                !('hasPrerequisiteChildren' in data)
                || (
                    Array.isArray(data.hasPrerequisiteChildren)
                    && data.hasPrerequisiteChildren.all(c => {
                        return c instanceof course.HasPrerequisiteWrappingItem;
                    })
                )
            );
    },

    construct: function(data) {
        return new course.SectionItem(
            data.id,
            data.nameKey,
            data.prerequisiteIds || [],
            data.sequentialChildren || [],
            data.hasPrerequisiteChildren || []
        );
    },

    instanceOf: course.SectionItem,

    represent: function(item) {
        return {
            id: item.id,
            nameKey: item.nameKey,
            prerequisiteIds: item.prerequisiteIds,
            sequentialChildren: item.sequentialChildren,
            hasPrerequisiteChildren: item.hasPrerequisiteChildren
        };
    }
});

let courseType = new yaml.Type('!course', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'id' in data
            && 'items' in data
            && Array.isArray(data.items)
            && data.items.all(e => e instanceof course.NamedCourseItem);
    },

    construct: function(data) {
        return new course.Course(
            data.id,
            data.items
        );
    },

    instanceOf: course.Course,

    represent: function(item) {
        return {
            id: item.id,
            items: item.items
        };
    }
});

let schema = yaml.Schema.create([
    levelType,
    sectionItemType,
    courseType
]);

module.exports.COURSE_CONFIG_SCHEMA = schema;
