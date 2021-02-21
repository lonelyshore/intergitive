'use strict';

const progress = require('./progress');
const paths = require('./paths');

class State {
    constructor() {
        this.levelState = {
            isDebug: true,
            stepsReady: false,
            interactable: false,
            levelName: '',
            terms: {
                elaborate: '',
                illustrate: '',
                instruct: '',
                verifyInputPlaceholder: '',
                verifyInputSubmitText: '',
                verifyInputFailed: '',
                verifyRepoDescription: '',
                checkpointReadyToSave: '',
                checkpointSaving: '',
                checkpointLoading: '',
                checkpointReadyToLoad: '',
                loadReference: '',
                saveProgress: '',

                startOperationButton: '',
                operationStatus: '',
                operationReady: '',
                operationRunning: '',
                operationFailed: '',
                operationCompleted: '',
                checkpointSaveButton: '',
                checkpointLoadButton: '',
                openWorkingPathDescription: '',
                preCompleteLevelDescription: '',
                generalExecutionDescription: '',
                completeLevelDescription: '',
                buttonConfirmText: '',
            },
            commonAssetRelativePaths: {
                imgCorrect: '',
            },
            renderSteps: [],
            stepStates: {},
            blockingSteps: [],
            needProcessSteps: [],
            currentBlockingStep: Number.MAX_SAFE_INTEGER,
            minProcessingStep: Number.MAX_SAFE_INTEGER,
            actionExecutor: null,
            checkpoints: {},
            repoSetupNames: [],
            workingPaths: {},
        };
        this.courseState = {
            isReady: false,
            courseTree: null,
            courseList: null,
            courseItemIdToUnlockStatus: null,
            courseName: ''
        };
        this.pageState = {
            displayingNode: null,
        };
        this.progress = new progress.ProgressProvider(paths.progressPath);
    }
};

module.exports.State = State;