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
        loadingText: function() {
            return store.state.terms.checkpointLoading;
        },
        savingText: function() {
            return store.state.terms.checkpointSaving;
        },
        stepState: function() {
            return store.state.stepStates[this.stepKey];
        },
        processState: function() {
            return this.stepState.state.processState.current;
        },
    },
    props: {
        stepKey: String,
    },
    mounted: function() {
        if (this.stepState.state.processState.current === stepConfig.ProcessState.PROCESSING) {
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

            store.executeActions(this.stepState.step.saveActions)
            .then(result => {
                if (result) {
                    this.phase = PHASE.FOR_LOADING;
                }
                else {
                    this.phase = PHASE.SAVING_FAILED;
                }
            })
            .catch(err => {
                console.error(err);
                this.phase = PHASE.SAVING_FAILED;
            });
        },
        load: function(event) {

            if (this.phase !== PHASE.FOR_LOADING) {
                return;
            }

            this.phase.current = PHASE.LOADING;

            store.executeActions(this.stepState.step.loadActions)
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
    <div v-html="description"></div>
    <button v-on:click="save">Save</button>
    <button v-on:click="load">Load</button>
    Current Phase: {{phase.current}}
</div>`
}