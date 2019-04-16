"use strict";

let yaml = require("js-yaml");
let action = require("./config-action");
let step = require("./config-step");
let level = require("./config-level");

const isString = function(obj) {
    return typeof obj === 'string' || obj instanceof String;
}

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

let debugLogActionType = new yaml.Type("!log", {
    kind: "scalar",

    resolve: function(data) {
        return data !== null && isString(data);
    },

    construct: function(data) {
        return new action.DebugLogAction(data);
    },

    instanceOf: action.DebugLogAction,

    represent: function(logAction) {
        return logAction.msg;
    }
});

let tryLoadCheckpointActionType = new yaml.Type("!tryLoadCheckpoint", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null 
            && data instanceof Object
            && "repoSetupName" in data;
    },

    construct: function(data) {
        return new action.TryLoadCheckpointAction(
            data.repoSetupName
        );
    },

    instanceOf: action.TryLoadCheckpointAction,

    represent: function(action) {
        return {
            repoSetupName: action.repoSetupName
        };
    }
});

let loadReferenceActionType = new yaml.Type("loadReference", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && "repoSetupName" in data
            && "referenceVersionName" in data;
    },

    construct: function(data) {
        return new action.LoadReferenceAction(
            data.repoSetupName,
            data.referenceVersionName
        );
    },

    instanceOf: action.LoadReferenceAction,

    represent: function(action) {
        return {
            repoSetupName: action.repoSetupName,
            referenceVersionName: action.referenceVersionName
        };
    }
});

let verifyStepType = new yaml.Type("!verify", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && "repoSetupName" in data
            && isString(data.repoSetupName);
    },

    construct: function(data) {
        return new step.VerifyStep(data.repoSetupName);
    },

    instanceOf: step.VerifyStep,

    represent: function(verifyStep) {
        return {};
    }
});

let executeActionStepType = new yaml.Type("!execute", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && "actions" in data
            && Array.isArray(data.actions);
    },

    construct: function(data) {
        return new step.ExecuteActionStep(data.actions);
    },

    instanceOf: step.ExecuteActionStep,
    
    represent: function(step) {
        return {
            actions: step.actions
        };
    }
});

let elaborateStepType = new yaml.Type("!elaborate", {
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

let instructStepType = new yaml.Type("!instruct", {
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

let checkpointStepType = new yaml.Type("!checkpoint", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && "repoSetupName" in data
            && isString(data.repoSetupName)
            && "checkpointName" in data
            && isString(data.checkpointName);
    },

    construct: function(data) {
        return new step.CheckpointStep(
            data.repoSetupName,
             data.checkpointName
        );
    },

    instanceOf: step.CheckpointStep,

    represent: function(checkpoingStep) {
        return checkpoingStep.name;
    }
});

let repoVcsSetupType = new yaml.Type("!repoVcs", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && "workingPath" in data
            && isString(data.workingPath)
            && (
                "referenceStoreName" in data
                || "checkpointStoreName" in data
            )
            && (
                !("referenceStoreName" in data)
                || isString(data.referenceStoreName)
            )
            && (
                !("checkpointStoreName" in data)
                || isString(data.checkpointStoreName)
            );
    },

    construct: function(data) {
        return new level.RepoVcsSetup(
            data.workingPath,
            data.referenceStoreName || "",
            data.checkpointStoreName || ""
        );
    },

    instanceOf: level.RepoVcsSetup,

    represent: function(data) {
        return {
            workingPath: data.workingPath,
            referenceStoreName: data.referenceStoreName,
            checkpointStoreName: data.checkpointStoreName
        };
    }
});

let levelType = new yaml.Type("!level", {
    kind: "mapping",

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && "steps" in data
            && Array.isArray(data.steps)
            && (
                !"repoVcsSetups" in data
                || data.RepoVcsSetup instanceof Object
            );
    },

    construct: function(data) {
        return new level.Level(
            data.steps,
            data.repoVcsSetups || {}
        );
    },

    instanceOf: level.Level,

    represent: function(data) {
        return {
            steps: data.steps,
            repoVcsSetups: data.repoVcsSetups
        };
    }
});

let schema = yaml.Schema.create(yaml.DEFAULT_SAFE_SCHEMA, [
    addFileActionType,
    removeFileActionType,
    debugLogActionType,
    tryLoadCheckpointActionType,
    loadReferenceActionType,

    executeActionStepType,
    verifyStepType,
    elaborateStepType,
    instructStepType,
    checkpointStepType,

    repoVcsSetupType,
    levelType
]);

module.exports.CONFIG_SCHEMA = schema;
