"use strict";

const ActionExecutor = require("./action-executor").ActionExecutor;

class Action {
    /**
     * 
     * @param {ActionExecutor} actionExecutor 
     * @returns {Promise<any>}
     */
    executeBy(actionExecutor) {
        return Promise.reject(new Error(`Should implement action evaluator method for ${this}`));
    }
};

/**
 * @inheritdoc
 */
class WriteFileAction extends Action {
    /**
     * 
     * @param {Array<string>} sourceAssetIds
     * @param {Array<string>} destinationPaths
     */
    constructor(sourceAssetIds, destinationPaths) {
        super();

        this.klass = "WriteFileAction";
        this.sourceAssetIds = sourceAssetIds;
        this.destinationPaths = destinationPaths;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeWriteFile(this.sourceAssetIds, this.destinationPaths);
    }
}

/**
 * @inheritdoc
 */
class RemoveFileAction extends Action {
    constructor(paths) {
        super();

        this.klass = "RemoveFileAction";
        this.paths = paths;
    }

    executeBy(actionExecutor){
        return actionExecutor.executeRemoveFile(this.paths);
    }
}

/**
 * @inheritdoc
 */
class MoveFileAction extends Action {
    constructor(sourcePaths, targetPaths) {
        super();

        this.klass = "MoveFileAction";
        this.sourcePaths = sourcePaths;
        this.targetPaths = targetPaths;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeMoveFile(this.sourcePaths, this.targetPaths);
    }
}

class DebugLogAction extends Action {
    constructor(msg) {
        super();

        this.klass = "DebugLogAction";
        this.msg = msg;
    }
}

class SaveCheckpointAction extends Action {
    constructor(repoSetupName, checkpointName) {
        super();
        this.klass = "SaveCheckpoint";
        this.repoSetupName = repoSetupName;
        this.checkpointName = checkpointName;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeSaveCheckpoint(
            this.repoSetupName, 
            this.checkpointName
        );
    }
}

class LoadCheckpointAction extends Action {
    constructor(repoSetupName, checkpointName) {
        super();
        this.klass = "LoadCheckPoint";
        this.repoSetupName = repoSetupName;
        this.checkpointName = checkpointName;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeLoadCheckpoint(
            this.repoSetupName, 
            this.checkpointName
        );
    }    
}

class LoadReferenceAction extends Action {
    constructor(repoSetupName, referenceVersionName) {
        super();
        this.klass = "LoadReferenceAction";
        this.repoSetupName = repoSetupName;
        this.referenceVersionName = referenceVersionName;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeLoadReference(
            this.repoSetupName, 
            this.referenceVersionName
        );
    }    
}

class CompareReferenceAction extends Action {
    constructor(repoSetupName, referenceVersionName) {
        super();
        this.klass = 'CompareReferenceAction';
        this.repoSetupName = repoSetupName;
        this.referenceVersionName = referenceVersionName;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeCompareReference(
            this.repoSetupName,
            this.referenceVersionName
        );
    }
}

/**
 * @inheritdoc
 */
class StageAction extends Action {
    constructor(repoSetupName, pathSpecs) {
        super();
        this.klass = "StageAction";
        this.repoSetupName = repoSetupName;
        this.pathSpecs = pathSpecs;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeStaging(this.repoSetupName, this.pathSpecs);
    }
}

/**
 * @inheritdoc
 */
class StageAllAction extends Action {
    constructor(repoSetupName) {
        super();
        this.klass = "StageAllAction";
        this.repoSetupName = repoSetupName;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeStaging(this.repoSetupName, [ "*" ]);
    }
}

/**
 * @inheritdoc
 */
class SetRemoteAction extends Action {
    constructor(localSetupName, remoteSetupName, remoteNickName) {
        super();
        this.klass = 'SetRemoteAction';
        this.localSetupName = localSetupName;
        this.remoteSetupName = remoteSetupName;
        this.remoteNickName = remoteNickName;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeSetRemote(
            this.localSetupName,
            this.remoteSetupName,
            this.remoteNickName
        );
    }
}

/**
 * @inheritdoc
 */
class PushAction extends Action {
    constructor(localSetupName, remoteNickName, refSpecs) {
        super();
        this.klass = 'PushAction';
        this.localSetupName = localSetupName;
        this.remoteNickName = remoteNickName;
        this.refSpecs = refSpecs;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executePushRemote(
            this.localSetupName,
            this.remoteNickName,
            this.refSpecs
        );
    }
}

/**
 * @inheritdoc
 */
class PushAllAction extends Action {
    constructor(localSetupName, remoteNickName, isForce) {
        super();
        this.klass = 'PushAllAction';
        this.localSetupName = localSetupName;
        this.remoteNickName = remoteNickName;
        this.isForce = isForce;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executePushAll(
            this.localSetupName, 
            this.remoteNickName,
            this.isForce
        );
    }
}

/**
 * @inheritdoc
 */
class CheckoutAction extends Action {
    constructor(repoSetupName, refSpecs, isForce) {
        super();
        this.repoSetupName = repoSetupName;
        this.refSpecs = refSpecs;
        this.isForce = isForce;
    }

    executeBy(actionExecutor) {
        return Promise.reject(new Error('not implemented'));
    }
}

/**
 * @inheritdoc
 */
class MergeAction extends Action {
    constructor(repoSetupName, withBranch) {
        super();
        this.klass = "MergeAction";
        this.repoSetupName = repoSetupName;
        this.withBranch = withBranch;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeMerge(this.repoSetupName, this.withBranch);
    }
}

/**
 * @inheritdoc
 */
class FetchAction extends Action {
    constructor(localSetupName, remoteNickName) {
        super();
        this.klass = 'Fetch';
        this.localSetupName = localSetupName;
        this.remoteNickName = remoteNickName;
    }

    executeBy(actionExecutor) {
        return Promise.reject(new Error('not implemented'));
    }
}

class CommitAction extends Action {
    constructor(repoSetupName, commitMessage) {
        super();
        this.repoSetupName = repoSetupName;
        this.commitMessage = commitMessage;
    }

    executeBy(actionExecutor) {
        return Promise.reject(new Error('not implemented'));
    }
}

class SetUserAction extends Action {
    constructor(repoSetupName, userName, userEmail) {
        super();
        this.klass = 'SetUser';
        this.repoSetupName = repoSetupName;
        this.userName = userName;
        this.userEmail = userEmail;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeSetUser(
            this.repoSetupName,
            this.userName,
            this.userEmail
        );
    }
}


module.exports.Action = Action;
module.exports.WriteFileAction = WriteFileAction;
module.exports.RemoveFileAction = RemoveFileAction;
module.exports.MoveFileAction = MoveFileAction;

module.exports.DebugLogAction = DebugLogAction;

module.exports.CheckoutAction = CheckoutAction;
module.exports.StageAction = StageAction;
module.exports.StageAllAction = StageAllAction;
module.exports.CommitAction = CommitAction;
module.exports.MergeAction = MergeAction;
module.exports.FetchAction = FetchAction;

module.exports.SetRemoteAction = SetRemoteAction;
module.exports.PushAction = PushAction;
module.exports.PushAllAction = PushAllAction;

module.exports.SetUserAction = SetUserAction;

module.exports.SaveCheckpointAction = SaveCheckpointAction;
module.exports.LoadCheckpointAction = LoadCheckpointAction;
module.exports.LoadReferenceAction = LoadReferenceAction;
module.exports.CompareReferenceAction = CompareReferenceAction;