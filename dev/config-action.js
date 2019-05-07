"use strict";

const upstream = require("../lib/config-action");
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
class MergeAction extends upstream.Action {
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
class GitCommandAction extends upstream.Actiont {
    constructor(repoSetupName, command, commandArguments) {
        super();
        this.klass = "GitCommandAction";
        this.repoSetupName = repoSetupName;
        this.command = command;
        this.arguments = commandArguments;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeGitCommand(this.repoSetupName, this.command, this.commandArguments);
    }
}

module.exports = Object.assign({}, upstream);
module.exports.UnstageAction = UnstageAction;
module.exports.UnstageAllAction = UnstageAllAction;
module.exports.MergeAction = MergeAction;
module.exports.ContinueMergeAction = ContinueMergeAction;
module.exports.CleanCheckoutAction = CleanCheckoutAction;
module.exports.GitCommandAction = GitCommandAction;