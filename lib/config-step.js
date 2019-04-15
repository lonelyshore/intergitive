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
    constructor() {
        super();
        this.klass = "VerifyStep";
    }
}

class CheckpointStep extends Step {
    constructor(name) {
        super();
        this.klass = "CheckpointStep";
        this.name = name;
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