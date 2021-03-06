"use strict";

const upstream = require("../src/common/config-action");
const ActionExecutor = require("./action-executor").DevActionExecutor;

class UnstageAction extends upstream.Action {
    constructor(repoSetupName, pathSpec) {
        super();
        this.klass = "UnstageAction";
        this.repoSetupName = repoSetupName;
        this.pathSpec = pathSpec;
    }
}

class UnstageAllAction extends upstream.Action {
    constructor(repoSetupName) {
        super();
        this.klass = "UnstageAllAction";
        this.repoSetupName = repoSetupName;
    }
}


/**
 * @inheritdoc
 */
class ContinueMergeAction extends upstream.Action {
    constructor(repoSetupName) {
        super();
        this.klass = "ContinueMergeAction";
        this.repoSetupName = repoSetupName;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeContinueMerge(this.repoSetupName);
    }
}

/**
 * @inheritdoc
 */
class CleanCheckoutAction extends upstream.Action {
    constructor(repoSetupName, commitish) {
        super();
        this.klass = "CleanCheckoutAction";
        this.repoSetupName = repoSetupName;
        this.commitish = commitish;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeCleanCheckout(this.repoSetupName, this.commitish);
    }
}

/**
 * @inheritdoc
 */
class GitCommandAction extends upstream.Action {
    constructor(repoSetupName, commandArguments, ignoreError) {
        super();
        this.klass = "GitCommandAction";
        this.repoSetupName = repoSetupName;
        this.arguments = commandArguments;
        this.ignoreError = ignoreError;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeGitCommand(this.repoSetupName, this.arguments, this.ignoreError);
    }
}

class SaveRepoReferenceAction extends upstream.Action {
    constructor(repoSetupName, referenceName) {
        super();
        this.klass = 'SaveRepoReferenceAction';
        this.repoSetupName = repoSetupName;
        this.referenceName = referenceName;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeSaveReference(this.repoSetupName, this.referenceName);
    }
}

/**
 * Extracts archive to a repo store as its starting point
 */
class LoadRepoReferenceArchiveAction extends upstream.Action {
    constructor(repoSetupName, assetId) {
        super();
        this.klass = 'LoadRepoReferenceArchiveAction';
        this.repoSetupName = repoSetupName;
        this.assetId = assetId;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeLoadRepoReferenceArchive(this.repoSetupName, this.assetId);
    }
}

class IdleAction extends upstream.Action {
    constructor(seconds) {
        super();
        this.klass = 'IdleAction';
        this.seconds = seconds;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeIdle(this.seconds);
    }
}

class CloneRepoAction extends upstream.Action {
    constructor(sourceRepoSetupName, destinationRepoSetupName) {
        super();
        this.klass = 'CloneRepoAction';
        this.sourceRepoSetupName = sourceRepoSetupName;
        this.destinationRepoSetupName = destinationRepoSetupName;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeCloneRepo(
            this.sourceRepoSetupName,
            this.destinationRepoSetupName
        );
    }
}

module.exports = Object.assign({}, upstream);
module.exports.UnstageAction = UnstageAction;
module.exports.UnstageAllAction = UnstageAllAction;
module.exports.ContinueMergeAction = ContinueMergeAction;
module.exports.CleanCheckoutAction = CleanCheckoutAction;
module.exports.GitCommandAction = GitCommandAction;
module.exports.SaveRepoReferenceAction = SaveRepoReferenceAction;
module.exports.LoadRepoReferenceArchiveAction = LoadRepoReferenceArchiveAction;
module.exports.IdleAction = IdleAction;
module.exports.CloneRepoAction = CloneRepoAction;