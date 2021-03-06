'use strict';

const yaml = require('js-yaml');
const course = require('./config-course');

const isString = require('./utility').typeCheck.isString;

let levelType = new yaml.Type('!level', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && 'id' in data
            && isString(data.id)
            && 'nameKey' in data
            && isString(data.nameKey)
            && 'configAssetId' in data
            && isString(data.configAssetId)
            && (
                !('prerequisiteIds' in data)
                || (
                    Array.isArray(data.prerequisiteIds)
                    && data.prerequisiteIds.every(p => isString(p))
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

let sequentialSectionItemType = new yaml.Type('!sequential-section', {
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
                    && data.prerequisiteIds.every(p => isString(p))
                )
            )
            && 'children' in data
            && Array.isArray(data.children)
            && data.children.every(c => {
                    return c !== null && c instanceof course.NamedCourseItem;
            });
    },

    construct: function(data) {
        return new course.SequentialSectionItem(
            data.id,
            data.nameKey,
            data.prerequisiteIds || [],
            data.children
        );
    },

    instanceOf: course.SequentialSectionItem,

    represent: function(item) {
        return {
            id: item.id,
            nameKey: item.nameKey,
            prerequisiteIds: item.prerequisiteIds,
            children: item.children,
        };
    }
});

let freeAccessSectionItemType = new yaml.Type('!free-access-section', {
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
                    && data.prerequisiteIds.every(p => isString(p))
                )
            )
            && 'children' in data
            && Array.isArray(data.children)
            && data.children.every(c => {
                    return c !== null && c instanceof course.NamedCourseItem;
            });
    },

    construct: function(data) {
        return new course.FreeAccessSectionItem(
            data.id,
            data.nameKey,
            data.prerequisiteIds || [],
            data.children
        );
    },

    instanceOf: course.FreeAccessSectionItem,

    represent: function(item) {
        return {
            id: item.id,
            nameKey: item.nameKey,
            prerequisiteIds: item.prerequisiteIds,
            children: item.children,
        };
    }
});

let courseType = new yaml.Type('!course', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'id' in data
            && isString(data.id)
            && 'nameKey' in data
            && isString(data.nameKey)
            && 'children' in data
            && Array.isArray(data.children)
            && data.children.every(c => {
                    return c !== null && c instanceof course.NamedCourseItem;
            });
    },

    construct: function(data) {
        return new course.Course(
            data.id,
            data.nameKey,
            data.children
        );
    },

    instanceOf: course.Course,

    represent: function(item) {
        return {
            id: item.id,
            nameKey: item.nameKey,
            children: item.children
        };
    }
});

let schema = yaml.Schema.create([
    levelType,
    sequentialSectionItemType,
    freeAccessSectionItemType,
    courseType
]);

module.exports.COURSE_CONFIG_SCHEMA = schema;
