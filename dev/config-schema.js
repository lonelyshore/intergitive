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
    kind: "mapping",

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
    kind: "mapping",

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

let mergeActionType = new yaml.Type("!merge", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && "repoSetupName" in data
            && isString(data.repoSetupName)
            && "withBranch" in data
            && isString(data.withBranch);
    },

    construct: function(data) {
        return new actionConfig.MergeAction(
            data.repoSetupName,
            data.withBranch
        );
    },

    instanceOf: actionConfig.MergeAction
});

let continueMergeActionType = new yaml.Type("!continueMerge", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && "repoSetupName" in data
            && isString(data.repoSetupName);
    },

    construct: function(data) {
        return new actionConfig.ContinueMergeAction(
            data.repoSetupName
        );
    },

    instanceOf: actionConfig.ContinueMergeAction
});

let cleanCheckoutActionType = new yaml.Type("!cleanCheckout", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && "repoSetupName" in data
            && isString(data.repoSetupName)
            && "commitish" in data
            && isString(data.commitish);
    },

    construct: function(data) {
        return new actionConfig.CleanCheckoutAction(
            data.repoSetupName,
            data.commitish
        );
    },

    instanceOf: actionConfig.CleanCheckoutAction
});

let gitCommandActionType = new yaml.Type("!git", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && "repoSetupName" in data
            && isString(data.repoSetupName)
            && "command" in data
            && isString(data.command);
    },

    construct: function(data) {
        return new actionConfig.GitCommandAction(
            data.repoSetupName,
            data.command,
            data.arguments || []
        );
    },

    instanceOf: actionConfig.GitCommandAction,
});

let schema = yaml.Schema.create(upstream.LEVEL_CONFIG_SCHEMA, [
    unstageActionType,
    unstageAllActionType,
    mergeActionType,
    continueMergeActionType,
    cleanCheckoutActionType,
    gitCommandActionType
]);

module.exports.LEVEL_CONFIG_SCHEMA = schema;