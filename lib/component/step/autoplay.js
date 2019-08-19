'use strict';

const readonly = require('../../readonly');
const stepConfig = require('../../config-step');
const Phase = stepConfig.AutoFirstProcessPhase;

exports = module.exports = {
    data: function() {
        return {
            phase: Phase.BEFORE_PROCESS
        }
    },
    computed: {
        store: function() {
            return this.$root.$data.store;
        },
        levelState: function() {
            return this.store.state.levelState;
        },
        title: function() {
            return this.levelState.terms[
                this.stepState.step.descriptionId
            ];
        },
        statusDescription: function() {
            if (this.phase === Phase.BEFORE_PROCESS) {
                return this.levelState.terms.operationReady;
            }
            else if (this.isRunning) {
                return this.levelState.terms.operationRunning;
            }
            else if (this.isCompleted) {
                return this.levelState.terms.operationCompleted;
            }
            else {
                return this.levelState.terms.operationFailed;
            }
        },
        buttonText: function() {
            return this.levelState.terms.startOperationButton;
        },
        stepState: function() {
            return this.levelState.stepStates[this.stepKey];
        },
        processState: function() {
            return this.stepState.state.processState;
        },
        isDebug: function() {
            return this.levelState.isDebug;
        },        
        isRunning: function() {
            return this.phase === Phase.AUTO_RUN
                || this.phase === Phase.MANUAL_RUN;
        },
        isCompleted: function() {
            return this.phase === Phase.SUCCESS;
        },
        canRunManually: function() {
            return this.phase === Phase.FAILED
                || this.phase === Phase.MANUAL_IDLE;
        },
        correctImagePath: function() {
            return this.levelState.commonAssetRelativePaths.img_correct;
        }        
    },
    props: {
        stepKey: String,
    },
    mounted: function() {
        if (this.stepState.state.processState === stepConfig.ProcessState.PROCESSING) {
            this.phase = Phase.AUTO_RUN;
            this.autoProcess();
        }
    },
    watch: {
        processState: function(val, oldVal) {
            if (val === stepConfig.ProcessState.PROCESS_COMPLETE) {
                this.store.unblock(this.stepKey);
            }
            else if (val === stepConfig.ProcessState.PROCESSING) {
                this.phase = Phase.AUTO_RUN;
                this.autoProcess();
            }
            else if (val === stepConfig.ProcessState.PREPARE_PROCESS) {
                this.phase = Phase.BEFORE_PROCESS;
            }
        }
    },
    methods: {
        process: function(event) {
            if (!this.canRunManually) {
                return;
            }
            this.phase = Phase.MANUAL_RUN;

            this.store.executeActions(this.stepState.step.actions)
            .then(result => {
                if (result) {
                    this.onSuccess();
                }
                else {
                    this.phase = Phase.FAILED;
                }
            })
            .catch(err => {
                console.error(err);
                this.phase = Phase.FAILED;
            });
        },
        autoProcess: function() {
            this.store.executeActions(this.stepState.step.actions)
            .then(result => {
                if (result) {
                    this.onSuccess();
                }
                else {
                    this.phase = Phase.MANUAL_IDLE;
                }
            })
            .catch(err => {
                console.error(err);
                this.phase = Phase.MANUAL_IDLE;
            });
        },
        onSuccess: function() {
            this.phase = Phase.SUCCESS;
            this.store.markProcessComplete(this.stepKey);
        }
    },
    template: `
<div class="level-block autoplay">

    <span class="title">{{title}}</span>

    <div class="processing-box">
        {{statusDescription}}

        <button 
            drift-right
            v-on:click="process"
            v-bind:disabled="!canRunManually"
            v-if="!isCompleted">
            {{buttonText}}
        </button>

        <img
            drift-right 
            class="inline-img"
            v-if="isCompleted"
            v-bind:src="correctImagePath">
        </img>
    </div>

    <div v-if="isDebug">
        Current Phase: {{phase}}
    </div>
</div>`
}