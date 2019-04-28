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

class RemoveFileAction extends Action {
    constructor(paths) {
        super();

        this.klass = "RemoveFileAction";
        this.paths = paths;
    }
}

class DebugLogAction extends Action {
    constructor(msg) {
        super();

        this.klass = "DebugLogAction";
        this.msg = msg;
    }
}

class TryLoadCheckpointAction extends Action {
    constructor(repoSetupName) {
        super();
        this.klass = "TryLoadCheckPoint";
        this.repoSetupName = repoSetupName;
    }
}

class LoadReferenceAction extends Action {
    constructor(repoSetupName, referenceVersionName) {
        super();
        this.klass = "LoadReferenceAction";
        this.repoSetupName = repoSetupName;
        this.referenceVersionName = referenceVersionName;
    }
}

/**
 * @inheritdoc
 */
class StageAction extends Action {
    constructor(repoSetupName, pathSpec) {
        super();
        this.klass = "StageAction";
        this.repoSetupName = repoSetupName;
        this.pathSpec = pathSpec;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeStaging(this.repoSetupName, this.pathSpec);
    }
}

class UnstageAction extends Action {
    constructor(repoSetupName, pathSpec) {
        super();
        this.klass = "UnstageAction";
        this.repoSetupName = repoSetupName;
        this.pathSpec = pathSpec;
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
        return actionExecutor.executeStaging(this.repoSetupName, [ "*", "**/*" ]);
    }
}

class UnstageAllAction extends Action {
    constructor(repoSetupName) {
        super();
        this.klass = "UnstageAllAction";
        this.repoSetupName = repoSetupName;
    }
}

module.exports.Action = Action;
module.exports.WriteFileAction = WriteFileAction;
module.exports.RemoveFileAction = RemoveFileAction;

module.exports.DebugLogAction = DebugLogAction;

module.exports.StageAction = StageAction;
module.exports.StageAllAction = StageAllAction;
module.exports.UnstageAction = UnstageAction;
module.exports.UnstageAllAction = UnstageAllAction;

module.exports.TryLoadCheckpointAction = TryLoadCheckpointAction;
module.exports.LoadReferenceAction = LoadReferenceAction;