"use strict";

const ActionExecutor = require("./action-executor").DevActionExecutor;

class UnstageAction extends Action {
    constructor(repoSetupName, pathSpec) {
        super();
        this.klass = "UnstageAction";
        this.repoSetupName = repoSetupName;
        this.pathSpec = pathSpec;
    }
}

class UnstageAllAction extends Action {
    constructor(repoSetupName) {
        super();
        this.klass = "UnstageAllAction";
        this.repoSetupName = repoSetupName;
    }
}


module.exports.UnstageAction = UnstageAction;
module.exports.UnstageAllAction = UnstageAllAction;