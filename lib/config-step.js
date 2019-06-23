"use strict";

const action = require("./config-action");
const assert = require('assert');

class Step {
    createInitialState() {
        return {
            isBlocked: false
        };
    }
}

const interactable = Sup => class extends Sup {
    get isInteractable() {
        return true;
    }

    createInitialState() {
        return Object.assign(
            super.createInitialState(), 
            {
                isInteractable: false
            }
        );
    }
}

const renderable = (Sup, componentType) => class extends Sup {
    get componentType() {
        return componentType;
    }

    createInitialState() {
        return Object.assign(
            super.createInitialState(),
            {
                isEnabled: false
            }
        );
    }
}

const hasPhase = (Sup, PhaseType) => class extends Sup {
    createInitialState() {
        
        assert(PhaseType.prototype instanceof StepPhase, `${PhaseType} should be a subclass of "Phase"`);

        return Object.assign(
            super.createInitialState(),
            {
                phase: new PhaseType()
            }
        );
    }
};

const blocking = Sup => class extends Sup {
    get isBlocking() {
        return true;
    }
}

const verifyStep = (Sup, componentType) => {
    return class extends hasPhase(
        renderable(
            blocking(interactable(Sup)), 
            componentType
        ),
        UserOperablePhase
    ) {};
};

class StepPhase {

    constructor() {
        this.current = null;
    }
}

class UserOperablePhase extends StepPhase {
    static get IDLE() {
        return 'idle';
    }

    static get RUNNING() {
        return 'running';
    }

    static get SUCCESS() {
        return 'success';
    }

    static get FAILED() {
        return 'failed';
    }

    constructor() {
        super();
        this.current = UserOperablePhase.IDLE;
    }
}

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

class ElaborateStep extends renderable(Step, 'elaborate') {
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

class IllustrateStep extends renderable(Step, 'illustrate') {
    /**
     * 
     * @param {string} descriptionId 
     */
    constructor(descriptionId) {
        super();
        this.klass = "IllustrateStep";
        this.descriptionId = descriptionId;
    }
}

class InstructStep extends renderable(Step, 'instruct') {
    /**
     * 
     * @param {string} descriptionId 
     */
    constructor(descriptionId) {
        super();

        this.klass = "InstructStep";
        this.descriptionId = descriptionId;
    }
}

class VerifyInputStep extends verifyStep(Step, 'verify-input') {
    /**
     * 
     * @param {String} answer 
     * @param {String} descriptionId 
     */
    constructor(answer, descriptionId) {
        super();
        this.klass = 'VerifyInputFieldStep';
        this.answer = answer;
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
module.exports.VerifyInputStep = VerifyInputStep;
module.exports.VerifyStep = VerifyStep;
module.exports.ElaborateStep = ElaborateStep;
module.exports.IllustrateStep = IllustrateStep;
module.exports.InstructStep = InstructStep;
module.exports.CheckpointStep = CheckpointStep;
module.exports.UserOperablePhase = UserOperablePhase;