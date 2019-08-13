"use strict";

const action = require("./config-action");
const readonly = require('./readonly');
const assert = require('assert');

class Step {
    createInitialState() {
        return {
            isBlocked: false
        };
    }

    deepCloneInto(source, target) {
        target.isBlocked = source.isBlocked;
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

    deepCloneInto(source, target) {
        super.deepCloneInto(source, target);
        target.isInteractable = source.isInteractable;
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

    deepCloneInto(source, target) {
        super.deepCloneInto(source, target);
        target.isEnabled = source.isEnabled;
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

    deepCloneInto(source, target) {
        super.deepCloneInto(source, target);
        target.phase = new PhaseType();
        target.phase.current = source.phase.current;
    }    
};

const blocking = Sup => class extends Sup {
    get isBlocking() {
        return true;
    }
}

const needProcess = Sup => class extends blocking(Sup) {
    get needProcess() {
        return true;
    }

    createInitialState() {
        return Object.assign(
            super.createInitialState(),
            {
                processState: ProcessState.PREPARE_PROCESS
            }
        );
    }

    deepCloneInto(source, target) {
        super.deepCloneInto(source, target);
        target.processState = source.processState;
    }
}

const verifyStep = (Sup, componentType) => {
    return class extends renderable(
        needProcess(interactable(Sup)), 
        componentType
    ) {};
};

const autoplayStep = (Sup, descriptionId) => {
    return class extends renderable(
        needProcess(interactable(Sup)), 
        'auto-play'
    ) {

        get descriptionId() {
            return descriptionId;
        }
        
    };
};

const checkpointStep = (Sup) => {
    return class extends renderable(
        needProcess(interactable(Sup)),
        'checkpoint'
    ) {

    };
};

const repeatableUserActionStep = (Sup) => {
    return class extends renderable(
        interactable(Sup),
        'repeatable-user-actions'
    ) {
        /**
         * 
         * @param {Object} store 
         * @returns {Promise<String>} returns the description to be displayed
         */
        getDescription(store) {
            return Promise.resolve('** Please implement getDescription of this step');
        }

        /**
         * @param {Object} store
         * @param {String} stepKey
         * @returns {Promise<boolean>} returns true if action succeded, false if failed.
         */
        takeAction(store, stepKey) {
            return Promise.reject(new Error('Not implemented'));
        }
    };
}

class StepPhase {

    constructor() {
        this.current = null;
    }
}

let UserDrivenProcessPhase = {
    IDLE: Symbol('user_driven_idle'),
    RUNNING: Symbol('user_driven_running'),
    SUCCESS: Symbol('user_driven_success'),
    FAILED: Symbol('user_driven_failed')
};

UserDrivenProcessPhase = readonly.wrap(UserDrivenProcessPhase);

let AutoFirstProcessPhase = {
    BEFORE_PROCESS: Symbol('auto_first_driven_before_process'),
    AUTO_RUN: Symbol('auto_first_auto_run'),
    SUCCESS: Symbol('auto_first_success'),
    FAILED: Symbol('auto_first_failed'),
    MANUAL_IDLE: Symbol('auto_first_manual_idle'),
    MANUAL_RUN: Symbol('auto_first_manual_run')
};

AutoFirstProcessPhase = readonly.wrap(AutoFirstProcessPhase);

let ProcessState = {
    PREPARE_PROCESS: Symbol('prepare_process'),
    PROCESSING: Symbol('processing'),
    PROCESS_COMPLETE: Symbol('process_complete')
}

ProcessState = readonly.wrap(ProcessState);

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

class VerifyRepoStep extends verifyStep(Step, 'verify-repo') {
    constructor(repoSetupName, referenceName) {
        super();
        this.klass = "VerifyRepoStep";
        this.repoSetupName = repoSetupName;
        this.referenceName = referenceName
    }
}

class CheckpointStep extends checkpointStep(Step) {
    constructor(repoSetupNames, checkpointName) {
        super();
        this.klass = "CheckpointStep";
        this.repoSetupNames = repoSetupNames;
        this.checkpointName = checkpointName;
    }
}

class OpenWorkingPathStep extends repeatableUserActionStep(Step) {
    constructor(repoSetupName) {
        super();
        this.klass = 'OpenWorkingPathStep';
        this.repoSetupName = repoSetupName;
    }

    getDescription(store) {
        return Promise.resolve(
            store.state.terms['openWorkingPathDescription']
            .replace(
                '{}', 
                store.state.workingPaths[this.repoSetupName]
            )
        );
    }

    takeAction(store, stepKey) {
        return store.openWorkingPath(stepKey);
    }
}

let AUTO_PLAY_DESCRIPTION_IDS = {
    LOAD_REFERENCE: 'loadReference'
}

AUTO_PLAY_DESCRIPTION_IDS = readonly.wrap(AUTO_PLAY_DESCRIPTION_IDS);

class LoadReferenceStep extends autoplayStep(Step, AUTO_PLAY_DESCRIPTION_IDS.LOAD_REFERENCE) {

    constructor(repoSetupName, referenceName) {
        super();
        this.klass = 'LoadReferenceStep';
        this.repoSetupName = repoSetupName;
        this.referenceName = referenceName;

        this.actions = [
            new action.LoadReferenceAction(
                repoSetupName,
                referenceName
            )
        ];
    }
}

module.exports.Step = Step;
module.exports.ActionStep = ActionStep;
module.exports.NeedPlayerActionStep = NeedPlayerActionStep;
module.exports.ExecuteActionStep = ExecuteActionStep;
module.exports.VerifyInputStep = VerifyInputStep;
module.exports.VerifyRepoStep = VerifyRepoStep;
module.exports.ElaborateStep = ElaborateStep;
module.exports.IllustrateStep = IllustrateStep;
module.exports.InstructStep = InstructStep;
module.exports.CheckpointStep = CheckpointStep;
module.exports.LoadReferenceStep = LoadReferenceStep;
module.exports.OpenWorkingPathStep = OpenWorkingPathStep;
module.exports.UserDrivenProcessPhase = UserDrivenProcessPhase;
module.exports.AutoFirstProcessPhase = AutoFirstProcessPhase;
module.exports.ProcessState = ProcessState;
module.exports.AUTO_PLAY_DESCRIPTION_IDS = AUTO_PLAY_DESCRIPTION_IDS;