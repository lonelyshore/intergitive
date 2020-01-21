'use strict';

let yaml = require('js-yaml');
let action = require('./config-action');
let step = require('./config-step');
let level = require('./config-level');
let dummyDevSchemaDict = require('./dummy-dev-action-config-schema').devActionSchemaDict;

const isString = function(obj) {
    return typeof obj === 'string' || obj instanceof String;
};

const isBool = function(obj) {
    return typeof(obj) === 'boolean'
};

const memberIsStringArray = function(data, memberName) {
    return memberName in data
        && data[memberName] !== null
        && Array.isArray(data[memberName])
        && data[memberName].every(e => isString(e));
}

let writeFileActionType = new yaml.Type('!act.writeFile', {
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

/**
 * !act.removeFile removes files mentioned in targetPaths.
 * Each file path can point to a file or a folder (no need for slash at the end).
 * When it points to a folder, the entire folder will be removed recursively.
 * 
 * targetPaths are paths relative to the working directory at run time.
 * Since all paths are relative paths, there is no need to specify repository name.
 * 
 */
let removeFileActionType = new yaml.Type('!act.removeFile', {
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

let moveFileActionType = new yaml.Type('!act.moveFile', {
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

let debugLogActionType = new yaml.Type('!act.log', {
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

let stageActionType = new yaml.Type('!act.stage', {
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

let stageAllActionType = new yaml.Type('!act.stageAll', {
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

let setRemoteActionType = new yaml.Type('!act.setRemote', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null 
            && data instanceof Object
            && 'localSetupName' in data
            && isString(data.localSetupName)
            && 'remoteSetupName' in data
            && isString(data.remoteSetupName)
            && 'remoteNickName' in data
            && isString(data.remoteNickName);
    },

    construct: function(data) {
        return new action.SetRemoteAction(
            data.localSetupName,
            data.remoteSetupName,
            data.remoteNickName
        );
    },

    instanceOf: action.SetRemoteAction,
});

let pushActionType = new yaml.Type('!act.push', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'localSetupName' in data
            && isString(data.localSetupName)
            && 'remoteNickName' in data
            && isString(data.remoteNickName)
            && 'refspecs' in data
            && (isString(data.refspecs) || memberIsStringArray(data, 'refspecs'));
    },

    construct: function(data) {
        return new action.PushAction(
            data.localSetupName,
            data.remoteNickName,
            memberIsStringArray(data, 'refspecs') ? data.refspecs : [ data.refspecs ]
        );
    },

    instanceOf: action.PushAction
});

let pushAllActionType = new yaml.Type('!act.pushAll', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'localSetupName' in data
            && isString(data.localSetupName)
            && 'remoteNickName' in data
            && isString(data.remoteNickName)
            && (!('isForce' in data) || isBool(data.isForce));
    },

    construct: function(data) {
        return new action.PushAllAction(
            data.localSetupName,
            data.remoteNickName,
            'isForce' in data ? data.isForce : false
        );
    },

    instanceOf: action.PushAllAction
});

let loadReferenceActionType = new yaml.Type('!act.loadReference', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'referenceName' in data
            && isString(data.referenceName);
    },

    construct: function(data) {
        return new action.LoadReferenceAction(
            data.repoSetupName,
            data.referenceName
        );
    },

    instanceOf: action.LoadReferenceAction,    
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

let verifyRepoStepType = new yaml.Type('!verifyOneRepo', {
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

let verifyAllRepoStepType = new yaml.Type('!verifyRepo', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && (!('referenceName' in data) || isString(data.referenceName));
    },

    construct: function(data) {
        return new step.VerifyAllRepoStep(data.referenceName);
    },

    instanceOf: step.VerifyAllRepoStep,

    represent: function(step) {
        return {
            referenceName: step.referenceName
        };
    }
});

let needActionStepType = new yaml.Type('!dev.needAction', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'actions' in data
            && Array.isArray(data.actions);
    },

    construct: function(data) {
        return new step.NeedPlayerActionStep(data.actions);
    },

    instanceOf: step.NeedPlayerActionStep,

    represent: function(step) {
        return {
            actions: step.actions
        };
    }
});

let devActionStepType = new yaml.Type('!dev.devAction',  {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'actions' in data
            && Array.isArray(data.actions);
    },

    construct: function(data) {
        return new step.DevActionStep(data.actions);
    },

    instanceOf: step.DevActionStep,

    represent: function(step) {
        return {
            actions: step.actions
        };
    }   
})

let executeActionStepType = new yaml.Type('!execute', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'actions' in data
            && Array.isArray(data.actions)
            && (
                !('descriptionId' in data)
                || isString(data.descriptionId)
            );
    },

    construct: function(data) {
        return new step.ExecuteActionStep(data.descriptionId, data.actions);
    },

    instanceOf: step.ExecuteActionStep,
    
    represent: function(step) {
        return {
            descriptionId: step.descriptionId,
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
            && isString(data.descriptionId)
            && (
                !('needConfirm' in data)
                || isBool(data.needConfirm)
            );
    },

    construct: function(data) {
        return new step.ElaborateStep(data.descriptionId, data.needConfirm || false);
    },

    instanceOf: step.ElaborateStep,

    represent: function(elaborateStep) {
        return {
            descriptionId: elaborateStep.descriptionId,
            needConfirm: elaborateStep.needConfirm,
        };
    }
});

let illustrateStepType = new yaml.Type('!illustrate', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'descriptionId' in data
            && isString(data.descriptionId)
            && (
                !('needConfirm' in data)
                || isBool(data.needConfirm)
            );
    },

    construct: function(data) {
        return new step.IllustrateStep(data.descriptionId, data.needConfirm || false);
    },

    instanceOf: step.IllustrateStep,

    represent: function(step) {
        return {
            descriptionId: step.descriptionId,
            needConfirm: step.needConfirm,
        };
    }
});

let instructStepType = new yaml.Type('!instruct', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && 'descriptionId' in data
            && isString(data.descriptionId)
            && (
                !('needConfirm' in data)
                || isBool(data.needConfirm)
            );
    },

    construct: function(data) {
        return new step.InstructStep(data.descriptionId, data.needConfirm || false);
    },

    instanceOf: step.InstructStep,

    represent: function(step) {
        return {
            descriptionId: step.descriptionId,
            needConfirm: step.needConfirm,
        };
    }
});

let partialCheckpointStepType = new yaml.Type('!partialCheckpoint', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupNames' in data
            && memberIsStringArray(data, 'repoSetupNames')
            && 'checkpointName' in data
            && isString(data.checkpointName);
    },

    construct: function(data) {
        return new step.CheckpointStep(
            data.repoSetupNames,
            data.checkpointName
        );
    },

    instanceOf: step.CheckpointStep,

    represent: function(checkpoingStep) {
        return {
            repoSetupNames: checkpoingStep.repoSetupNames,
            checkpointName: checkpoingStep.checkpointName
        };
    }
});

let checkpointStepType = new yaml.Type('!checkpoint', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'checkpointName' in data
            && isString(data.checkpointName);
    },

    construct: function(data) {
        return new step.AllRepoCheckpointStep(
            data.checkpointName
        );
    },

    instanceOf: step.AllRepoCheckpointStep,

    represent: function(checkpoingStep) {
        return {
            checkpointName: checkpoingStep.checkpointName
        }
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

let autoPlayActionsStepType = new yaml.Type('!playActions', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'descriptionId' in data
            && isString(data.descriptionId)
            && 'actions' in data
            && data.actions.every(act => act instanceof action.Action);
    },

    construct: function(data) {
        return new step.AutoPlayActionsStep(
            data.descriptionId,
            data.actions
        );
    },

    instanceOf: step.AutoPlayActionsStep,

    represent: function(step) {
        return {
            descriptionId: step.descriptionId,
            actions: step.actions
        };
    }
});

let loadLastLevelFinalSnapshotStep = new yaml.Type('!loadLastLevelFinalSnapshot', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupNames' in data
            && memberIsStringArray(data, 'repoSetupNames');
    },

    construct: function(data) {
        return new step.LoadLastLevelFinalSnapshotStep(
            data.repoSetupNames
        );
    },

    instanceOf: step.LoadLastLevelFinalSnapshotStep,

    represent: function(step) {
        return {
            repoSetupNames: step.repoSetupNames
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
                !('repoType' in data)
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

        setRemoteActionType,
        pushActionType,
        pushAllActionType,
        loadReferenceActionType,

        needActionStepType,
        devActionStepType,
        executeActionStepType,
        illustrateStepType,
        verifyInputStepType,
        verifyRepoStepType,
        verifyAllRepoStepType,
        elaborateStepType,
        instructStepType,
        partialCheckpointStepType,
        checkpointStepType,
        loadReferenceStepType,
        autoPlayActionsStepType,
        loadLastLevelFinalSnapshotStep,
        openWorkingPathStep,

        repoVcsSetupType,
        levelType
    ].concat(dummyDevSchemas)
);

module.exports.LEVEL_CONFIG_SCHEMA = schema;
