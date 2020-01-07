"use strict";

const yaml = require("js-yaml");
const actionConfig = require("./config-action");
const dummyActionConfigDict = require('../lib/dummy-dev-action-config-schema').devActionSchemaDict;
const upstream = require("../lib/level-config-schema");


const isString = function(obj) {
    return typeof obj === 'string' || obj instanceof String;
};

const memberIsStringArray = function(data, memberName) {
    return memberName in data
        && data[memberName] !== null
        && Array.isArray(data[memberName])
        && data[memberName].every(e => isString(e));
}

let unstageActionType = new yaml.Type(
    dummyActionConfigDict.unstage.tag, 
    {
        kind: "mapping",

        resolve: function(data) {
            return data !== null
                && data instanceof Object
                && memberIsStringArray(data, "pathSpecs")
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
    }
);

let unstageAllActionType = new yaml.Type(
    dummyActionConfigDict.unstageAll.tag, 
    {
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
    }
);

let mergeActionType = new yaml.Type(
    dummyActionConfigDict.merge.tag, 
    {
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
    }
);

let continueMergeActionType = new yaml.Type(
    dummyActionConfigDict.continueMerge.tag, 
    {
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
    }
);

let cleanCheckoutActionType = new yaml.Type(
    dummyActionConfigDict.cleanCheckout.tag, 
    {
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
    }
);

let gitCommandActionType = new yaml.Type(
    dummyActionConfigDict.gitCommand.tag, 
    {
        kind: "mapping",

        resolve: function(data) {
            return data !== null
                && "repoSetupName" in data
                && isString(data.repoSetupName)
                && (!('arguments' in data) || memberIsStringArray(data, 'arguments'));
        },

        construct: function(data) {
            return new actionConfig.GitCommandAction(
                data.repoSetupName,
                data.arguments || []
            );
        },

        instanceOf: actionConfig.GitCommandAction,
    }
);

let saveRepoReferenceActionType = new yaml.Type(
    dummyActionConfigDict.saveRepoReference.tag,
    {
        kind: 'mapping',

        resolve: function(data) {
            return data !== null
                && 'repoSetupName' in data
                && isString(data.repoSetupName)
                && 'referenceName' in data
                && isString(data.referenceName);
        },

        construct: function(data) {
            return new actionConfig.SaveRepoReferenceAction(
                data.repoSetupName,
                data.referenceName
            );
        },

        instanceOf: actionConfig.SaveRepoReferenceAction,
    }
);

let loadRepoReferenceArchiveActionType = new yaml.Type(
    dummyActionConfigDict.loadRepoReferenceArchive.tag,
    {
        kind: 'mapping',

        resolve: function(data) {
            return data !== null
                && 'repoSetupName' in data
                && isString(data.repoSetupName)
                && 'assetId' in data
                && isString(data.assetId);
        },

        construct: function(data) {
            return new actionConfig.LoadRepoReferenceArchiveAction(
                data.repoSetupName,
                data.assetId
            );
        },

        instanceOf: actionConfig.LoadRepoReferenceArchiveAction,
    }
)

let schema = yaml.Schema.create(upstream.LEVEL_CONFIG_SCHEMA, [
    unstageActionType,
    unstageAllActionType,
    mergeActionType,
    continueMergeActionType,
    cleanCheckoutActionType,
    gitCommandActionType,
    saveRepoReferenceActionType,
    loadRepoReferenceArchiveActionType,
]);

module.exports.LEVEL_CONFIG_SCHEMA = schema;