'use strict';

const store = require('../store');
const readonly = require('../readonly');
const stepConfig = require('../config-step');

let AUTO_PHASES = {
    PREPARE: Symbol('prepare'),
    AUTO_RUNNING: Symbol('auto-running'),
    MANUAL_RUNNING: Symbol('manual_running')
};

AUTO_PHASES = readonly.wrap(AUTO_PHASES);

exports = module.exports = {
    data: function() {
        return {
            internalPhase: AUTO_PHASES.PREPARE
        }
    },
    computed: {
        description: function() {
            return store.state.terms[
                this.stepState.step.descriptionId
            ];
        },
        stepState: function() {
            return store.state.stepStates[this.stepKey];
        },
        processPhase: function() {
            return this.stepState.state.processState.current;
        },
        phase: function() {
            return this.stepState.state.phase.current;
        }
    },
    props: {
        stepKey: String,
    },
    mounted: function() {
        if (this.stepState.state.processState.current === stepConfig.ProcessState.PROCESSING) {
            this.internalPhase = AUTO_PHASES.AUTO_RUNNING;
        }
    },
    watch: {
        internalPhase: function(val, oldVal) {
            if (oldVal === AUTO_PHASES.PREPARE) {
                if (val === AUTO_PHASES.AUTO_RUNNING) {
                    this.process(undefined);
                }
            }
        },
        phase: function(val, oldVal) {
            if (this.internalPhase === AUTO_PHASES.AUTO_RUNNING && val === stepConfig.UserOperablePhase.FAILED) {
                this.internalPhase = AUTO_PHASES.MANUAL_RUNNING;
            }
        },
        processPhase: function(val, oldVal) {
            if (val === stepConfig.ProcessState.PROCESS_COMPLETE) {
                store.unblock(this.stepKey);
            }
        }
    },
    methods: {
        process: function(event) {
            //store.verifyInputAnswer(this.stepKey, this.input);
            store.verifyInputAnswer(this.stepState.step.actions, this.stepKey)
            .then(result => {
                if (result) {
                    store.markProcessComplete(stepKey);
                }
            });
        }
    },
    template: `
<div class="level-block verify">
    <div v-html="description"></div>
    <button v-on:click="process">Retry</button>
    Current Phase: {{phase}}
</div>`
}