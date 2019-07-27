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
        title: function() {
            return store.state.terms[
                this.stepState.step.descriptionId
            ];
        },
        statusDescription: function() {
            if (this.phase.current === Phase.BEFORE_PROCESS) {
                return store.state.terms.operationReady;
            }
            else if (this.isRunning) {
                return store.state.terms.operationRunning;
            }
            else if (this.isCompleted) {
                return store.state.terms.operationCompleted;
            }
            else {
                return store.state.terms.operationFailed;
            }
        },
        buttonText: function() {
            return store.state.terms.startOperationButton;
        },
        stepState: function() {
            return store.state.stepStates[this.stepKey];
        },
        processState: function() {
            return this.stepState.state.processState.current;
        },
        isDebug: function() {
            return store.state.isDebug;
        },        
        isRunning: function() {
            return this.phase.current === Phase.AUTO_RUN
                || this.phase.current === Phase.MANUAL_RUN;
        },
        isCompleted: function() {
            return this.phase.current === Phase.SUCCESS;
        },
        canRunManually: function() {
            return this.phase.current === Phase.FAILED
                || this.phase.current === Phase.MANUAL_IDLE;
        },
        correctImagePath: function() {
            return store.state.commonAssetRelativePaths.img_correct;
        }        
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
        processState: function(val, oldVal) {
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
            if (!this.canRunManually) {
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
<div class="level-block autoplay">

    <span class="title">{{title}}</span>

    <div class="processing-box">
        {{statusDescription}}

        <button 
            v-on:click="process"
            v-bind:disabled="isRunning"
            v-if="!isCompleted">
            {{buttonText}}
        </button>

        <img 
            class="inline-img"
            v-if="isCompleted"
            v-bind:src="correctImagePath">
        </img>
    </div>

    <div v-if="isDebug">
        Current Phase: {{phase.current}}
    </div>
</div>`
}