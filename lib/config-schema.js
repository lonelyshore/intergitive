"use strict";

let yaml = require("js-yaml");
let action = require("./config-action");
let step = require("./config-step");
let level = require("./config-level");

let addFileActionType = new yaml.Type("!addFile", {
    kind: "sequence",

    resolve: function(data) {
        return data !== null
            && ("paths" in data || data instanceof string);
    },

    construct: function(data) {
        return new action.AddFileAction(
            data instanceof string ? [data] : data.paths);
    },

    instanceOf: action.AddFileAction,

    represent: function(addFileAction) {
        return addFileAction.paths;
    }
});

let removeFileActionType = new yaml.Type("!removeFile", {
    kind: "sequence",

    resolve: function(data) {
        return data !== null
            && ("paths" in data || data instanceof string);
    },

    construct: function(data) {
        return new action.RemoveFileAction(
            data instanceof string ? [data] : data.paths);
    },

    instanceOf: action.RemoveFileAction,

    represent: function(rmFileAction) {
        return rmFileAction.paths;
    }
});

let verifyStepType = new yaml.Type("!verify", {
    kind: "mapping",

    resolve: function(data) {
        return data === null || data === undefined;
    },

    construct: function(data) {
        return new step.VerifyStep();
    },

    instanceOf: step.VerifyStep,

    represent: function(verifyStep) {
        return {};
    }
});

let elaborateStep = new yaml.Type("!elaborate", {
    kind: "scalar",

    resolve: function(data) {
        return data instanceof string;
    },

    construct: function(data) {
        return new step.ElaborateStep(data);
    },

    instanceOf: step.ElaborateStep,

    represent: function(elaborateStep) {
        return elaborateStep.descriptionId;
    }
});

let instructStep = new yaml.Type("!instruct", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && descriptionId in data
            && data.descriptionId instanceof string
            && correctActions in data
            && Array.isArray(data.correctActions);
    },

    construct: function(data) {
        return new step.InstructStep(data.descriptionId, data.correctActions);
    },

    instanceOf: InstructStep,
});

let checkpointStep = new yaml.Type("!checkpoint", {
    kind: "scalar",

    resolve: function(data) {
        return data !== null
            && data instanceof string;
    },

    construct: function(data) {
        return new step.CheckpointStep(data);
    },

    instanceOf: step.CheckpointStep,

    represent: function(checkpoingStep) {
        return checkpoingStep.name;
    }
});

let schema = yaml.Schema.create(yaml.DEFAULT_SAFE_SCHEMA, [
    addFileActionType,
    removeFileActionType,
    verifyStepType,
    elaborateStep,
    instructStep,
    checkpointStep
]);

module.exports.CONFIG_SCHEMA = schema;
