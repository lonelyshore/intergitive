'use strict';

const store = require('../store');
const readonly = require('../readonly');
const stepConfig = require('../config-step');


let PHASE = {
    BEFORE_SAVE: Symbol('before_save'),
    SAVING: Symbol('saving'),
    SAVING_FAILED: Symbol('saving_failed'),
    FOR_LOADING: Symbol('for_loading'),
    LOADING: Symbol('loading'),
    LOADING_FAILED: Symbol('loading_failed'),
};

PHASE = readonly.wrap(PHASE);

exports = module.exports = {
    data: function() {
        return {
            phase: PHASE.BEFORE_SAVE
        }
    },
    computed: {
        statusDescription: function() {
            switch(this.phase) {
                case PHASE.SAVING:
                    return store.state.terms.checkpointSaving;

                case PHASE.LOADING:
                    return store.state.terms.checkpointLoading;

                case PHASE.LOADING_FAILED:
                case PHASE.SAVING_FAILED:
                    return store.state.terms.operationFailed;

                case PHASE.FOR_LOADING:
                    return store.state.terms.checkpointReadyToLoad;

                case PHASE.BEFORE_SAVE:
                    return store.state.terms.checkpointReadyToSave;

                default:
                    return '';
            }
        },
        stepState: function() {
            return store.state.stepStates[this.stepKey];
        },
        processState: function() {
            return this.stepState.state.processState;
        },
        showSaveButton: function() {
            return this.phase === PHASE.SAVING_FAILED;
        },
        canLoad: function() {
            return this.phase === PHASE.FOR_LOADING
                || this.phase === PHASE.LOADING_FAILED;
        },
        saveButtonText: function() {
            return store.state.terms.checkpointSaveButton;
        },
        loadButtonText: function() {
            return store.state.terms.checkpointLoadButton;
        },
        isDebug: function() {
            return store.state.isDebug;
        },
    },
    props: {
        stepKey: String,
    },
    mounted: function() {
        if (this.stepState.state.processState === stepConfig.ProcessState.PROCESSING) {
            this.save(undefined);
        }
    },
    watch: {
        processState: function(val, oldVal) {
            if (val === stepConfig.ProcessState.PROCESS_COMPLETE) {
                store.unblock(this.stepKey);
            }
            else if (val === stepConfig.ProcessState.PROCESSING) {
                if (this.phase === PHASE.BEFORE_SAVE) {
                    this.save();
                }
                else {
                    store.markProcessComplete(this.stepKey);
                }
            }
            else if (val === stepConfig.ProcessState.PREPARE_PROCESS) {
                this.phase = PHASE.BEFORE_SAVE;
            }
        }
    },
    methods: {
        save: function(event) {

            if (this.phase !== PHASE.BEFORE_SAVE
                && this.phase !== PHASE.SAVING_FAILED) {
                return;
            }

            this.phase = PHASE.SAVING;

            store.saveCheckpoint(this.stepKey)
            .then(result => {
                if (result) {
                    this.phase = PHASE.FOR_LOADING;
                    store.markProcessComplete(this.stepKey);
                }
                else {
                    this.phase = PHASE.SAVING_FAILED;
                }
            });
        },
        load: function(event) {

            if (!this.canLoad) {
                return;
            }

            this.phase = PHASE.LOADING;

            store.loadCheckpoint(this.stepKey)
            .then(result => {
                if (result) {
                    this.phase = PHASE.FOR_LOADING;
                }
                else {
                    this.phase = PHASE.LOADING_FAILED;
                }
            })
            .catch(err => {
                console.error(err);
                this.phase = PHASE.LOADING_FAILED;
            });
        },
    },
    template: `
<div class="level-block verify">
    <span>{{statusDescription}}</span>

    <button drift-right v-on:click="save" v-if="showSaveButton">
        {{saveButtonText}}
    </button>

    <button drift-right v-on:click="load" v-if="canLoad">
        {{loadButtonText}}
    </button>

    <div v-if="isDebug">
        Current Phase: {{phase}}
    </div>
</div>`
}