'use strict';

const yaml = require('js-yaml');
const action = require('./config-action');
const step = require('./config-step');
const level = require('./config-level');
const dummyDevSchemaDict = require('./dummy-dev-action-config-schema').devActionSchemaDict;
const { typeCheck } = require('./utility');
const { isString, isBool } = typeCheck;

function memberIsStringArray(data, memberName) {
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

    instanceOf: action.AddFileAction,

    represent: function(data) {
        return {
            sourceAssetIds: data.sourceAssetIds,
            destinationPaths: data.destinationPaths
        };
    }
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
            && 'sourcePaths' in data
            && memberIsStringArray(data, 'sourcePaths')
            && 'targetPaths' in data
            && memberIsStringArray(data, 'targetPaths')
    },

    construct: function(data) {
        return new action.MoveFileAction(
            data.sourcePaths,
            data.targetPaths
        );
    },

    instanceOf: action.MoveFileAction,

    represent: function(action) {
        return {
            sourcePaths: action.sourcePaths,
            targetPaths: action.targetPaths
        };
    }
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

let checkoutActionType = new yaml.Type('!act.checkout', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'commitish' in data
            && isString(data.commitish);
    },

    construct: function(data) {
        return new action.CheckoutAction(
            data.repoSetupName,
            data.commitish
        );
    },

    instanceOf: action.CheckoutAction,

    represent: function(action) {
        return {
            repoSetupName: action.repoSetupName,
            commitish: action.commitish
        };
    }
});

let stageActionType = new yaml.Type('!act.stage', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'pathSpecs' in data
            && memberIsStringArray(data, 'pathSpecs')
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

let commitActionType = new yaml.Type('!act.commit', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'commitMessage' in data
            && isString(data.commitMessage);
    },

    construct: function(data) {
        return new action.CommitAction(
            data.repoSetupName,
            data.commitMessage
        );
    },

    instanceOf: action.CommitAction,

    represent: function(action) {
        return action;
    }
});

let mergeActionType = new yaml.Type('!act.merge', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'withBranch' in data
            && isString(data.withBranch);
    },

    construct: function(data) {
        return new action.MergeAction(
            data.repoSetupName,
            data.withBranch
        );
    },

    instanceOf: action.MergeAction,

    represent: function(action) {
        return action;
    }
});

let fetchActionType = new yaml.Type('!act.fetch', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'localSetupName' in data
            && isString(data.localSetupName)
            && 'remoteNickName' in data
            && isString(data.remoteNickName);
    },

    construct: function(data) {
        return new action.FetchAction(
            data.localSetupName,
            data.remoteNickName
        );
    },

    instanceOf: action.FetchAction,

    represent: function(action) {
        return action;
    }
});

let pullActionType = new yaml.Type('!act.pull', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'localSetupName' in data
            && isString(data.localSetupName)
            && 'remoteNickName' in data
            && isString(data.remoteNickName)
            && 'branchName' in data
            && isString(data.branchName);
    },

    construct: function(data) {
        return new action.PullAction([
            new action.FetchAction(
                data.localSetupName,
                data.remoteNickName
            ),

            new action.CheckoutAction(
                data.localSetupName,
                data.branchName
            ),

            new action.MergeAction(
                data.localSetupName,
                `${data.remoteNickName}/${data.branchName}`
            )
        ]);
    },

    instanceOf: action.PullAction,

    represent: function(pullAction) {
        return {
            localSetupName: pullAction.actions[0].localSetupName,
            remoteNickName: pullAction.actions[0].remoteNickName,
            branchName: pullAction.actions[1].commitish
        }
    }
});

let addRevisionActionType = new yaml.Type('!act.addRevision', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'commitMessage' in data
            && isString(data.commitMessage);
    },

    construct: function(data) {
        return new action.AddRevisionAction([
            new action.StageAllAction(
                data.repoSetupName
            ),

            new action.CommitAction(
                data.repoSetupName,
                data.commitMessage
            )
        ]);
    },

    instanceOf: action.AddRevisionAction,

    represent: function(addRevisionAction) {
        return {
            repoSetupName: addRevisionAction.actions[0].repoSetupName,
            commitMessage: addRevisionAction.actions[1].commitMessage
        }
    }
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
            && 'refSpecs' in data
            && (isString(data.refSpecs) || memberIsStringArray(data, 'refSpecs'));
    },

    construct: function(data) {
        return new action.PushAction(
            data.localSetupName,
            data.remoteNickName,
            memberIsStringArray(data, 'refSpecs') ? data.refSpecs : [ data.refSpecs ]
        );
    },

    instanceOf: action.PushAction,

    represent: function(action) {
        return {
            localSetupName: action.localSetupName,
            remoteNickName: action.remoteNickName,
            refSpecs: action.refSpecs
        };
    }
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

let setUserActionType = new yaml.Type('!act.setUser', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'userName' in data
            && isString(data.userName)
            && 'userEmail' in data
            && isString(data.userEmail);
    },

    construct: function(data) {
        return new action.SetUserAction(
            data.repoSetupName,
            data.userName,
            data.userEmail
        );
    },

    instanceOf: action.SetUserAction
});

let saveCheckpointActionType = new yaml.Type('!act.saveCheckpoint', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'checkpointName' in data
            && isString(data.checkpointName);
    },

    construct: function(data) {
        return new action.SaveCheckpointAction(
            data.repoSetupName,
            data.checkpointName
        );
    },

    instanceOf: action.SaveCheckpointAction,

    represent: function(action) {
        return {
            repoSetupName: action.repoSetupName,
            checkpointName: action.checkpointName
        }
    }
});

let loadCheckpointActionType = new yaml.Type('!act.loadCheckpoint', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'checkpointName' in data
            && isString(data.checkpointName);
    },

    construct: function(data) {
        return new action.LoadCheckpointAction(
            data.repoSetupName,
            data.checkpointName
        );
    },

    instanceOf: action.LoadCheckpointAction,
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

let compareReferenceActionType = new yaml.Type('!act.compareReference', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
        && 'repoSetupName' in data
        && isString(data.repoSetupName)
        && 'referenceName' in data
        && isString(data.referenceName);
    },

    construct: function(data) {
        return new action.CompareReferenceAction(
            data.repoSetupName,
            data.referenceName
        );
    },

    instanceOf: action.CompareReferenceAction,

    represent: function(action) {
        return {
            repoSetupName: action.repoSetupName,
            referenceName: action.referenceName
        }
    }
});

let verifyInputStepType = new yaml.Type('!verifyInput',  {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'answer' in data
            && isString(data.answer)
            && (!('descriptionId' in data) || isString(data.descriptionId))
            && (!('appendCheckpoint' in data) || isBool(data.appendCheckpoint));
    },

    construct: function(data) {
        return new step.VerifyInputStep(
            data.answer,
            data.descriptionId || null,
            data.appendCheckpoint === undefined ? false : data.appendCheckpoint);
    },

    instanceOf: step.VerifyInputStep,

    represent: function(step) {
        let ret = {
            answer: step.answer
        };

        if (step.descriptionId !== null) {
            ret.descriptionId = step.descriptionId;
        }

        if (step.appendCheckpoint !== null) {
            ret.appendCheckpoint = step.appendCheckpoint;
        }

        return ret;
    }
})

let verifyRepoStepType = new yaml.Type('!verifyOneRepo', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'referenceName' in data
            && isString(data.referenceName)
            && (!('appendCheckpoint' in data) || isBool(data.appendCheckpoint));
    },

    construct: function(data) {
        return new step.VerifyRepoStep(
            data.repoSetupName,
            data.referenceName,
            data.appendCheckpoint === undefined ? true : data.appendCheckpoint
        );
    },

    instanceOf: step.VerifyRepoStep,

    represent: function(step) {
        return {
            repoSetupName: step.repoSetupName,
            referenceName: step.referenceName,
            appendCheckpoint: step.appendCheckpoint
        };
    }
});

let verifyAllRepoStepType = new yaml.Type('!verifyRepo', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'referenceName' in data
            && isString(data.referenceName)
            && (!('appendCheckpoint' in data) || isBool(data.appendCheckpoint));
    },

    construct: function(data) {
        return new step.VerifyAllRepoStep(
            data.referenceName,
            data.appendCheckpoint === undefined ? true : data.appendCheckpoint
        );
    },

    instanceOf: step.VerifyAllRepoStep,

    represent: function(step) {
        return {
            referenceName: step.referenceName,
            appendCheckpoint: step.appendCheckpoint
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
            )
            && (!('appendCheckpoint' in data) || isBool(data.appendCheckpoint))
            && (!('resettingRepos' in data) || memberIsStringArray(data, 'resettingRepos'));
    },

    construct: function(data) {
        return new step.ExecuteActionStep(
            data.descriptionId,
            data.actions,
            data.appendCheckpoint === undefined ? true : data.appendCheckpoint,
            data.resettingRepos);
    },

    instanceOf: step.ExecuteActionStep,
    
    represent: function(step) {
        return {
            descriptionId: step.descriptionId,
            actions: step.actions
        };
    }
});

let autoPlayActionsStepType = new yaml.Type('!playActions', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && (
                !('descriptionId' in data)
                || isString(data.descriptionId)
            )
            && 'actions' in data
            && data.actions.every(act => act instanceof action.Action)
            && (!('appendCheckpoint' in data) || isBool(data.appendCheckpoint))
            && (!('resettingRepos' in data) || memberIsStringArray(data, 'resettingRepos'));
    },

    construct: function(data) {
        return new step.AutoPlayActionsStep(
            data.descriptionId,
            data.actions,
            data.appendCheckpoint === undefined ? true : data.appendCheckpoint,
            data.resettingRepos
        );
    },

    instanceOf: step.AutoPlayActionsStep,

    represent: function(step) {
        let ret = {
            actions: step.actions
        };

        if (step.descriptionId !== undefined)
            ret.descriptionId = step.descriptionId;

        if (step.appendCheckpoint !== undefined)
            ret.appendCheckpoint = step.appendCheckpoint;

        if (step.resettingRepos !== undefined)
            ret.resettingRepos = step.resettingRepos;

        return ret;
        
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
        return new step.ElaborateStep(
            data.descriptionId,
            data.needConfirm === undefined ? true : data.needConfirm
        );
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
        return new step.IllustrateStep(
            data.descriptionId,
            data.needConfirm === undefined ? true : data.needConfirm
        );
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
        return new step.InstructStep(
            data.descriptionId,
            data.needConfirm === undefined ? true : data.needConfirm
        );
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

let loadReferenceStepType = new yaml.Type('!loadOneReference', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'repoSetupName' in data
            && isString(data.repoSetupName)
            && 'referenceName' in data
            && isString(data.referenceName)
            && (!('appendCheckpoint' in data) || isBool(data.appendCheckpoint));
    },

    construct: function(data) {
        return new step.LoadReferenceStep(
            data.repoSetupName,
            data.referenceName,
            data.appendCheckpoint === undefined ? true : data.appendCheckpoint
        );
    },

    instanceOf: step.LoadReferenceStep,

    represent: function(step) {
        return {
            repoSetupName: step.repoSetupName,
            referenceName: step.referenceName,
            appendCheckpoint: step.appendCheckpoint
        };
    }
});

let loadAllReferenceStepType = new yaml.Type('!loadReference',  {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && 'referenceName' in data
            && isString(data.referenceName)
            && (!('appendCheckpoint' in data) || isBool(data.appendCheckpoint));
    },

    construct: function(data) {
        return new step.LoadAllReferenceStep(
            data.referenceName,
            data.appendCheckpoint === undefined ? true : data.appendCheckpoint
        );
    },

    instanceOf: step.LoadAllReferenceStep,

    represent: function(step) {
        return {
            referenceName: step.referenceName,
            appendCheckpoint: step.appendCheckpoint
        };
    }    
})

let loadLastLevelFinalSnapshotStep = new yaml.Type('!loadLastLevelFinalSnapshot', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null
            && data instanceof Object
            && (!('repoSetupNames' in data) || memberIsStringArray(data, 'repoSetupNames'))
            && (!('appendCheckpoint' in data) || isBool(data.appendCheckpoint));
    },

    construct: function(data) {
        return new step.LoadLastLevelFinalSnapshotStep(
            data.repoSetupNames || null,
            data.appendCheckpoint === undefined ? true : data.appendCheckpoint
        );
    },

    instanceOf: step.LoadLastLevelFinalSnapshotStep,

    represent: function(step) {

        let ret = {};

        if (step.repoSetupNames !== null) {
            ret.repoSetupNames = step.repoSetupNames;
        }

        if (step.appendCheckpoint !== undefined) {
            ret.appendCheckpoint = step.appendCheckpoint
        }

        return ret;
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
});

let completeLevelStep = new yaml.Type('!completeLevel', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null;
    },

    construct: function(data) {
        return new step.CompleteLevelStep();
    },

    instanceOf: step.CompleteLevelStep,

    represent: function(step) {
        return {};
    }
});

let saveProgressStep = new yaml.Type('!saveProgress', {
    kind: 'mapping',

    resolve: function(data) {
        return data !== null;
    },

    construct: function(data) {
        return new step.SaveProgressStep();
    },

    instanceOf: step.SaveProgressStep,

    represent: function(step) {
        return {};
    }
});

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
        checkoutActionType,
        stageActionType,
        stageAllActionType,
        commitActionType,
        mergeActionType,
        fetchActionType,
        pullActionType,
        addRevisionActionType,

        setRemoteActionType,
        pushActionType,
        pushAllActionType,
        setUserActionType,

        saveCheckpointActionType,
        loadCheckpointActionType,
        loadReferenceActionType,
        loadAllReferenceStepType,
        compareReferenceActionType,

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
        completeLevelStep,
        saveProgressStep,

        repoVcsSetupType,
        levelType
    ].concat(dummyDevSchemas)
);

module.exports.LEVEL_CONFIG_SCHEMA = schema;
