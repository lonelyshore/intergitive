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