"use strict";

const yaml = require("js-yaml");
const actionConfig = require("./config-action");
const upstream = require("../lib/level-config-schema");

const isString = function(obj) {
    return typeof obj === 'string' || obj instanceof String;
};

const memberIsStringArray = function(data, memberName) {
    return memberName in data
        && data[memberName] !== null
        && Array.isArray(data[memberName])
        && data[memberName].all(e => isString(e));
}

let unstageActionType = new yaml.Type("!unstage", {
    kind: mapping,

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && memberIsStringArray("pathSpecs")
            && "repoSetupName" in data
            && isString(data.repoSetupName);
    },

    construct: function(data) {
        return new actionConfig.UnstageAction(
            data.repoSetupName,
            data.pathSpecs
        );
    },

    instanceOf: actionConfig.UnstageAction
});

let unstageAllActionType = new yaml.Type("!unstageAll", {
    kind: mapping,

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && "repoSetupName" in data
            && isString(data.repoSetupName);
    },

    construct: function(data) {
        return new actionConfig.UnstageAllAction(data.repoSetupName);
    },

    instanceOf: actionConfig.UnstageAllAction
});

let schema = yaml.Schema.create(upstream.LEVEL_CONFIG_SCHEMA, [
    unstageActionType,
    unstageAllActionType
]);

module.exports.LEVEL_CONFIG_SCHEMA = schema;