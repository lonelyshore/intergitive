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

class InjectFileAction extends Action {
    /**
     * 
     * @param {Array<string>} sourceAssetIds
     * @param {Array<string>} destinationPaths
     */
    constructor(sourceAssetIds, destinationPaths) {
        super();

        this.klass = "InjectFileAction";
        this.sourceAssetIds = sourceAssetIds;
        this.destinationPaths = destinationPaths;
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

module.exports.Action = Action;
module.exports.InjectFileAction = InjectFileAction;
module.exports.RemoveFileAction = RemoveFileAction;
module.exports.DebugLogAction = DebugLogAction;
module.exports.TryLoadCheckpointAction = TryLoadCheckpointAction;
module.exports.LoadReferenceAction = LoadReferenceAction;