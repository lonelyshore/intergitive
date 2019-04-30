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
    constructor(repoSetupName, toBranch, fromBranch) {
        super();
        this.klass = "MergeAction";
        this.repoSetupName = repoSetupName;
        this.toBranch = toBranch;
        this.fromBranch = fromBranch;
    }

    executeBy(actionExecutor) {
        return actionExecutor.executeMerge(this.repoSetupName, this.toBranch, this.fromBranch);
    }
}

class CleanCheckoutAction extends upstream.Action {
    constructor(repoSetupName, commitish) {
        super();
        this.klass = "CleanCheckoutAction";
        this.commitish = commitish;
    }
}

module.exports = Object.assign({}, upstream);
module.exports.UnstageAction = UnstageAction;
module.exports.UnstageAllAction = UnstageAllAction;
module.exports.MergeAction = MergeAction;