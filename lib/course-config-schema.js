"use strict";

const yaml = require("js-yaml");
const course = require("./config-course");

const isString = function(obj) {
    return typeof obj === 'string' || obj instanceof String;
}

let levelType = new yaml.Type("!level", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && "id" in data
            && isString(data.id)
            && "nameKey" in data
            && isString(data.nameKey)
            && "configPath" in data
            && isString(data.configPath);
    },

    construct: function(data) {
        return new course.LevelItem(
            data.id,
            data.nameKey,
            data.configPath
        );
    },

    instanceOf: course.LevelItem,

    represent: function(item) {
        return {
            id: item.id,
            nameKey: item.nameKey,
            configPath: item.configPath
        };
    }
});

let prerequisiteWrappingItemType = new yaml.Type("!hasPrerequisite", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && "prerequisites" in data
            && Array.isArray(data.prerequisites)
            && data.prerequisites.all(p => {
                return isString(p);
            })
            && "item" in data
            && item instanceof NamedCourseItem;
    },

    construct: function(data) {
        return new course.HasPrerequisiteWrappingItem(
            data.prerequisites,
            data.item
        );
    },

    instanceOf: course.HasPrerequisiteWrappingItem,

    represent: function(item) {
        return {
            prerequisites: item.prerequisites,
            item: item.wrappedItem
        };
    }
});

let sectionItemType = new yaml.Type("!section", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && "id" in data
            && isString(data.id)
            && "nameKey" in data
            && isString(data.nameKey)
            && (
                !"sequentialChildren" in data
                || (
                    isArray(data.sequentialChildren)
                    && data.sequentialChildren.all(c => {
                        return c !== null && c instanceof course.NamedCourseItem;
                    })
                ) 
            )
            && (
                !"hasPrerequisiteChildren" in data
                || (
                    isArray(data.hasPrerequisiteChildren)
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
            data.sequentialChildren || [],
            data.hasPrerequisiteChildren || []
        );
    },

    instanceOf: course.SectionItem,
});

let schema = yaml.Schema.create([
    levelType,
    prerequisiteWrappingItemType,
    sectionItemType
]);

module.exports.COURSE_CONFIG_SCHEMA = schema;
