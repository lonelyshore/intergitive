'use strict';

let yaml = require('js-yaml');
let action = require('./config-action');
let step = require('./config-step');
let level = require('./config-level');
let dummyDevSchemaDict = require('./dummy-dev-action-config-schema').devActionSchemaDict;

const isString = function(obj) {
    return typeof obj === 'string' || obj instanceof String;
};

const memberIsStringArray = function(data, memberName) {
    return memberName in data
        && data[memberName] !== null
        && Array.isArray(data[memberName])
        && data[memberName].every(e => isString(e));
}

let writeFileActionType = new yaml.Type('!writeFile', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && memberIsStringArray(data, 'sourceAssetIds')
            && memberIsStringArray(data, 'destinationPaths')
            && data.sourceAssetIds.length === data.destinationPaths.length;
            
    },

    construct: function(data) {
        return new action.WriteFileAction(
            data.sourceAssetIds,
            data.destinationPaths
        );
    },

    instanceOf: action.AddFileAction
});

let removeFileActionType = new yaml.Type('!removeFile', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && memberIsStringArray(data, 'targetPaths');
    },

    construct: function(data) {
        return new action.RemoveFileAction(data.targetPaths);
    },

    instanceOf: action.RemoveFileAction,

    /**
     * 
     * @param {action.RemoveFileAction} rmFileAction 
     */
    represent: function(rmFileAction) {
        return {
            targetPaths: rmFileAction.paths
        };
    }
});

let moveFileActionType = new yaml.Type('!moveFile', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && 'sourcePath' in data
            && isString(data.sourcePath)
            && 'targetPath' in data
            && isString(data.targetPath)
    },

    construct: function(data) {
        return new action.MoveFileAction(
            data.sourcePath,
            data.targetPath
        );
    },

    instanceOf: action.MoveFileAction
});

let debugLogActionType = new yaml.Type('!log', {
    kind: 'scalar',

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

let stageActionType = new yaml.Type('!stage', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && memberIsStringArray('pathSpecs')
            && 'repoSetupName' in data
            && isString(data.repoSetupName);
    },

    construct: function(data) {
        return new action.StageAction(
            data.repoSetupName,
            data.pathSpecs
        );
    },

    instanceOf: action.StageAction
});

let stageAllActionType = new yaml.Type('!stageAll', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName);
    },

    construct: function(data) {
        return new action.StageAllAction(data.repoSetupName);
    },

    instanceOf: action.StageAllAction
});

let verifyInputStepType = new yaml.Type('!verifyInput',  {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'answer' in data
            && isString(data.answer)
            && (!('descriptionId' in data) || isString(data.descriptionId));
    },

    construct: function(data) {
        return new step.VerifyInputStep(data.answer, data.descriptionId || null);
    },

    instanceOf: step.VerifyInputStep,

    represent: function(step) {
        return step;
    }
})

let verifyRepoStepType = new yaml.Type('!verifyRepo', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && (!('referenceName' in data) || isString(data.referenceName));
    },

    construct: function(data) {
        return new step.VerifyRepoStep(data.repoSetupName, data.referenceName);
    },

    instanceOf: step.VerifyRepoStep,

    represent: function(step) {
        return {
            repoSetupName: step.repoSetupName,
            referenceName: step.referenceName
        };
    }
});

let executeActionStepType = new yaml.Type('!execute', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'actions' in data
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

let elaborateStepType = new yaml.Type('!elaborate', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'descriptionId' in data
            && isString(data.descriptionId);
    },

    construct: function(data) {
        return new step.ElaborateStep(data.descriptionId);
    },

    instanceOf: step.ElaborateStep,

    represent: function(elaborateStep) {
        return {
            descriptionId: elaborateStep.descriptionId
        };
    }
});

let illustrateStepType = new yaml.Type('!illustrate', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'descriptionId' in data
            && isString(data.descriptionId);
    },

    construct: function(data) {
        return new step.IllustrateStep(data.descriptionId);
    },

    instanceOf: step.IllustrateStep,

    represent: function(step) {
        return {
            descriptionId: step.descriptionId
        };
    }
});

let instructStepType = new yaml.Type('!instruct', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && 'descriptionId' in data
            && isString(data.descriptionId);
    },

    construct: function(data) {
        return new step.InstructStep(data.descriptionId);
    },

    instanceOf: step.InstructStep,
});

let checkpointStepType = new yaml.Type('!checkpoint', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'checkpointName' in data
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

let loadReferenceStepType = new yaml.Type('!loadReference', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'referenceName' in data
            && isString(data.referenceName);
    },

    construct: function(data) {
        return new step.LoadReferenceStep(
            data.repoSetupName,
            data.referenceName
        );
    },

    instanceOf: step.LoadReferenceStep,

    represent: function(step) {
        return {
            repoSetupName: step.repoSetupName,
            referenceName: step.referenceName
        };
    }
});

let openWorkingPathStep = new yaml.Type('!openWorkingPath', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName);
    },

    construct: function(data) {
        return new step.OpenWorkingPathStep(
            data.repoSetupName
        );
    },

    instanceOf: step.OpenWorkingPathStep,

    represent: function(step) {
        return {
            repoSetupName: step.repoSetupName
        };
    }
})

let repoVcsSetupType = new yaml.Type('!repoVcs', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && 'workingPath' in data
            && isString(data.workingPath)
            && (
                'referenceStoreName' in data
                || 'checkpointStoreName' in data
            )
            && (
                !('referenceStoreName' in data)
                || isString(data.referenceStoreName)
            )
            && (
                !('checkpointStoreName' in data)
                || isString(data.checkpointStoreName)
            )
            && (
                !('type' in data)
                || isString(data.repoType)
            );
    },

    construct: function(data) {
        return new level.RepoVcsSetup(
            data.workingPath,
            data.referenceStoreName || '',
            data.checkpointStoreName || '',
            data.repoType === 'remote' ? level.REPO_TYPE.REMOTE : level.REPO_TYPE.LOCAL
        );
    },

    instanceOf: level.RepoVcsSetup,

    represent: function(data) {
        return {
            workingPath: data.workingPath,
            referenceStoreName: data.referenceStoreName,
            checkpointStoreName: data.checkpointStoreName,
            repoType: data.repoType
        };
    }
});

let levelType = new yaml.Type('!level', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'steps' in data
            && Array.isArray(data.steps)
            && (
                !'repoVcsSetups' in data
                || data.repoVcsSetups instanceof Object
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

let dummyDevSchemas = [];
Object.keys(dummyDevSchemaDict).forEach(key => {
    dummyDevSchemas.push(dummyDevSchemaDict[key]);
});

let schema = yaml.Schema.create(
    yaml.DEFAULT_SAFE_SCHEMA, 
    [
        writeFileActionType,
        removeFileActionType,
        moveFileActionType,

        debugLogActionType,
        stageActionType,
        stageAllActionType,

        executeActionStepType,
        illustrateStepType,
        verifyInputStepType,
        verifyRepoStepType,
        elaborateStepType,
        instructStepType,
        checkpointStepType,
        loadReferenceStepType,
        openWorkingPathStep,

        repoVcsSetupType,
        levelType
    ].concat(dummyDevSchemas)
);

module.exports.LEVEL_CONFIG_SCHEMA = schema;
