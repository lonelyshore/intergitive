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

const interactableStep = (Sup, componentType) => {
    return class extends renderable(
        needProcess(interactable(Sup)), 
        componentType
    ) {};
};

const blockingExecutionStep = (Sup, isAutoStart) => {
    return class extends renderable(
        needProcess(interactable(Sup)), 
        'blocking-execution'
    ) {

        get isAutoStart() {
            return isAutoStart;
        }

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
};

const checkpointStep = (Sup) => {
    return class extends renderable(
        needProcess(interactable(Sup)),
        'checkpoint'
    ) {

    };
};

const hasActionsStep = (Sup) => {
    const actionsSym = Symbol("actions");
    const setSym = Symbol("set");

    return class extends Sup {
        get actions() {
            return this[setSym] ? this[actionsSym] : new Error('not implement');
        }

        set actions(val) {
            this[setSym] = true;
            this[actionsSym] = val;
        }
    }
}

const mayAppendCheckpointStep = (Sup) => {
    const appendCheckpointSym = Symbol('appendCheckpoint');
    const setSym = Symbol('set');

    return class extends Sup {
        get appendCheckpoint() {
            return this[setSym] ? this[appendCheckpointSym] : new Error('appendCheckpoint not set');
        }

        set appendCheckpoint(val) {
            this[setSym] = true;
            this[appendCheckpointSym] = val;
        }
    }
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

class NeedPlayerActionStep extends hasActionsStep(Step) {
    constructor(actions) {
        super();
        this.klass = 'NeedPlayerActionStep';
        this.actions = actions;
    }
}

class DevActionStep extends hasActionsStep(Step) {
    constructor(actions) {
        super();
        this.klass = 'DevActionStep';
        this.actions = actions;
    }
}

class ExecuteActionStep extends blockingExecutionStep(
    mayAppendCheckpointStep(hasActionsStep(Step)),
    false
) {
    constructor(descriptionId, actions, appendCheckpoint) {
        super();
        this.klass = 'ExecuteActionStep';
        this.actions = actions;
        this.descriptionId = descriptionId;
        this.appendCheckpoint = appendCheckpoint;
    }

    /**
     * 
     * @param {Object} store 
     * @returns {Promise<String>} returns the description to be displayed
     */
    getDescription(store) {
        return this.descriptionId ? 
            store.loadText(this.descriptionId) :
            Promise.resolve(store.state.levelState.terms.generalExecutionDescription);
    }

    /**
     * @param {Object} store
     * @param {String} stepKey
     * @returns {Promise<boolean>} returns true if action succeded, false if failed.
     */
    takeAction(store, stepKey) {
        return store.executeActions(this.actions);
    }
}

const descriptiveStep = (Step, mode) => {
    return class extends interactableStep(Step, 'descriptive') {
        /**
         * 
         * @param {string} descriptionId 
         * @param {string} needConfirm 
         */
        constructor(descriptionId, needConfirm) {
            super();
            this.klass = 'DescriptiveStep';
            this.descriptionId = descriptionId;
            this.needConfirm = needConfirm;
            this.mode = mode;
        }
    };
};

class ElaborateStep extends descriptiveStep(Step, 'elaborate') {
    constructor(descriptionId, needConfirm) {
        super(descriptionId, needConfirm);
    }
}

class IllustrateStep extends descriptiveStep(Step, 'illustrate') {
    constructor(descriptionId, needConfirm) {
        super(descriptionId, needConfirm);
    }
}

class InstructStep extends descriptiveStep(Step, 'instruct') {
    constructor(descriptionId, needConfirm) {
        super(descriptionId, needConfirm);
    }
}

class VerifyInputStep extends interactableStep(
    mayAppendCheckpointStep(Step),
    'verify-input'
) {
    /**
     * 
     * @param {String} answer 
     * @param {String} descriptionId 
     * @param {boolean} appendCheckpoint
     */
    constructor(answer, descriptionId, appendCheckpoint) {
        super();
        this.klass = 'VerifyInputFieldStep';
        this.answer = answer;
        this.descriptionId = descriptionId;
        this.appendCheckpoint = appendCheckpoint;
    }
}

class BaseVerifyRepoStep extends interactableStep(
    mayAppendCheckpointStep(Step),
    'verify-repo'
) {
    constructor(referenceName, appendCheckpoint) {
        super();
        this.klass = "BaseVerifyRepoStep";
        this.referenceName = referenceName;
        this.appendCheckpoint = appendCheckpoint;
    }
}

class VerifyRepoStep extends BaseVerifyRepoStep {
    constructor(repoSetupName, referenceName, appendCheckpoint) {
        super(referenceName, appendCheckpoint);
        this.klass = 'VerifyRepoStep';
        this.repoSetupName = repoSetupName;
    }
}

class VerifyAllRepoStep extends BaseVerifyRepoStep {
    constructor(referenceName, appendCheckpoint) {
        super(referenceName, appendCheckpoint);
        this.klass = 'VerifyAllRepoStep';
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

class AllRepoCheckpointStep extends checkpointStep(Step) {
    constructor(checkpointName) {
        super();
        this.klass = "AllRepoCheckpointStep";
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
            store.state.levelState.terms['openWorkingPathDescription']
            .replace(
                '{}', 
                store.state.levelState.workingPaths[this.repoSetupName]
            )
        );
    }

    takeAction(store, stepKey) {
        return store.openWorkingPath(stepKey);
    }
}

class CompleteLevelStep extends interactableStep(Step, 'complete-level') {
    constructor() {
        super();
        this.klass = 'CompleteLevelStep';
    }
}

class SaveProgressStep extends blockingExecutionStep(Step, true) {
    constructor() {
        super();
        this.klass = 'SaveProgressStep';
    }

    getDescription(store) {
        return Promise.resolve(store.state.levelState.terms.saveProgress);
    }

    takeAction(store, stepKey) {
        return store.saveProgress();
    }
}

class LoadReferenceStep extends blockingExecutionStep(
    mayAppendCheckpointStep(hasActionsStep(Step)),
    true
) {
    constructor(repoSetupName, referenceName, appendCheckpoint) {
        super();
        this.klass = 'LoadReferenceStep';
        this.repoSetupName = repoSetupName;
        this.referenceName = referenceName;
        this.appendCheckpoint = appendCheckpoint;

        this.actions = [
            new action.LoadReferenceAction(
                repoSetupName,
                referenceName
            )
        ];
    }

    getDescription(store) {
        return Promise.resolve(store.state.levelState.terms.loadReference);
    }

    takeAction(store, stepKey) {
        return store.executeActions(this.actions);
    }
}

class LoadAllReferenceStep extends blockingExecutionStep(
    mayAppendCheckpointStep(Step),
    true
) {
    constructor(referenceName, appendCheckpoint) {
        super();
        this.referenceName = referenceName;
        this.appendCheckpoint = appendCheckpoint;
    }

    getDescription(store) {
        return Promise.resolve(store.state.levelState.terms.loadReference);
    }

    takeAction(store, stepKey) {
        return store.loadAllRepoReferences(stepKey);
    }
}

class AutoPlayActionsStep extends blockingExecutionStep(hasActionsStep(Step), true) {
    constructor(descriptionId, actions) {
        super();
        this.klass = 'AutoPlayActionStep';

        this.actions = actions;
        this.descriptionId = descriptionId;
    }

    getDescription(store) {
        return store.loadText(this.descriptionId)
        .then(result => {
            return store.processAssetIdInText(result);
        });
    }

    takeAction(store, stepKey) {
        return store.executeActions(this.actions);
    }    
}

class LoadLastLevelFinalSnapshotStep extends blockingExecutionStep(
    mayAppendCheckpointStep(Step),
    true
) {

    constructor(repoSetupNames, appendCheckpoint) {
        super();
        this.klass = 'LoadLastLevelFinalSnapshotStep';
        this.repoSetupNames = repoSetupNames;
        this.appendCheckpoint = appendCheckpoint;
    }

    getDescription(store) {
        return Promise.resolve(store.state.levelState.terms.loadReference);
    }

    takeAction(store, stepKey) {
        return store.loadLastLevelFinalSnapshot(stepKey);
    }
}

module.exports.Step = Step;
module.exports.NeedPlayerActionStep = NeedPlayerActionStep;
module.exports.DevActionStep = DevActionStep;
module.exports.ExecuteActionStep = ExecuteActionStep;
module.exports.VerifyInputStep = VerifyInputStep;
module.exports.VerifyRepoStep = VerifyRepoStep;
module.exports.VerifyAllRepoStep = VerifyAllRepoStep;
module.exports.ElaborateStep = ElaborateStep;
module.exports.IllustrateStep = IllustrateStep;
module.exports.InstructStep = InstructStep;
module.exports.CheckpointStep = CheckpointStep;
module.exports.AllRepoCheckpointStep = AllRepoCheckpointStep;
module.exports.LoadReferenceStep = LoadReferenceStep;
module.exports.LoadAllReferenceStep = LoadAllReferenceStep;
module.exports.AutoPlayActionsStep = AutoPlayActionsStep;
module.exports.LoadLastLevelFinalSnapshotStep = LoadLastLevelFinalSnapshotStep;
module.exports.OpenWorkingPathStep = OpenWorkingPathStep;
module.exports.CompleteLevelStep = CompleteLevelStep;
module.exports.SaveProgressStep = SaveProgressStep;
module.exports.UserDrivenProcessPhase = UserDrivenProcessPhase;
module.exports.AutoFirstProcessPhase = AutoFirstProcessPhase;
module.exports.ProcessState = ProcessState;