"use strict";

const action = require("./config-action");

class Step {}

class ActionStep extends Step {
    /**
     * 
     * @param {Array<action.Action>} actions 
     */
    constructor(actions) {
        super();

        this.klass = "ActionStep";
        this.actions = actions;
    }
}

class NeedPlayerActionStep extends ActionStep {
    constructor(actions) {
        super(actions);
    }
}

class ExecuteActionStep extends ActionStep {
    constructor(actions) {
        super(actions);
    }
}

class ElaborateStep extends Step {
    /**
     * 
     * @param {string} descriptionId 
     */
    constructor(descriptionId) {
        super();
        this.klass = "ElaborateStep";
        this.descriptionId = descriptionId;
    }

    get componentType() {
        return 'elaborate';
    }
}

class InstructStep extends NeedPlayerActionStep {
    /**
     * 
     * @param {string} descriptionId 
     * @param {Array<action.Action>} correctActions 
     */
    constructor(descriptionId, correctActions) {
        super(correctActions);

        this.klass = "InstructStep";
        this.descriptionId = descriptionId;
    }
}

class VerifyStep extends Step {
    constructor(repoSetupName) {
        super();
        this.klass = "VerifyStep";
        this.repoSetupName = repoSetupName;
    }
}

class CheckpointStep extends Step {
    constructor(repoSetupName, checkpointName) {
        super();
        this.klass = "CheckpointStep";
        this.repoSetupName = repoSetupName;
        this.checkpointName = checkpointName;
    }
}

module.exports.Step = Step;
module.exports.ActionStep = ActionStep;
module.exports.NeedPlayerActionStep = NeedPlayerActionStep;
module.exports.ExecuteActionStep = ExecuteActionStep;
module.exports.VerifyStep = VerifyStep;
module.exports.ElaborateStep = ElaborateStep;
module.exports.InstructStep = InstructStep;
module.exports.CheckpointStep = CheckpointStep;