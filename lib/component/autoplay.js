'use strict';

const store = require('../store');
const readonly = require('../readonly');
const stepConfig = require('../config-step');
const Phase = stepConfig.AutoFirstProcessPhase;

exports = module.exports = {
    data: function() {
        return {
            phase: new Phase()
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
    },
    props: {
        stepKey: String,
    },
    mounted: function() {
        if (this.stepState.state.processState.current === stepConfig.ProcessState.PROCESSING) {
            this.phase.current = Phase.AUTO_RUN;
            this.autoProcess();
        }
    },
    watch: {
        processPhase: function(val, oldVal) {
            if (val === stepConfig.ProcessState.PROCESS_COMPLETE) {
                store.unblock(this.stepKey);
            }
            else if (val === stepConfig.ProcessState.PROCESSING) {
                this.phase.current = Phase.AUTO_RUN;
                this.autoProcess();
            }
            else if (val === stepConfig.ProcessState.PREPARE_PROCESS) {
                this.phase.current = Phase.BEFORE_PROCESS;
            }
        }
    },
    methods: {
        process: function(event) {
            if (this.phase.current === Phase.MANUAL_RUN) {
                return;
            }
            this.phase.current = Phase.MANUAL_RUN;

            store.executeActions(this.stepState.step.actions)
            .then(result => {
                if (result) {
                    this.onSuccess();
                }
                else {
                    this.phase.current = Phase.FAILED;
                }
            })
            .catch(err => {
                console.error(err);
                this.phase.current = Phase.FAILED;
            });
        },
        autoProcess: function() {
            store.executeActions(this.stepState.step.actions)
            .then(result => {
                if (result) {
                    this.onSuccess();
                }
                else {
                    this.phase.current = Phase.MANUAL_IDLE;
                }
            })
            .catch(err => {
                console.error(err);
                this.phase.current = Phase.MANUAL_IDLE;
            });
        },
        onSuccess: function() {
            this.phase.current = Phase.SUCCESS;
            store.markProcessComplete(this.stepKey);
        }
    },
    template: `
<div class="level-block verify">
    <div v-html="description"></div>
    <button v-on:click="process">Retry</button>
    Current Phase: {{phase}}
</div>`
}