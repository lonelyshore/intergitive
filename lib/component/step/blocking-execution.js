'use strict';

const readonly = require('../../readonly');
const stepConfig = require('../../config-step');
const Phase = stepConfig.AutoFirstProcessPhase;

exports = module.exports = {
    data: function() {
        return {
            phase: Phase.BEFORE_PROCESS,
            description: '',
        }
    },
    computed: {
        store: function() {
            return this.$root.$data.store;
        },
        levelState: function() {
            return this.store.state.levelState;
        },
        statusDescription: function() {
            if (this.isReadyToRun) {
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
        isReadyToRun: function() {
            return this.stepState.step.isAutoStart ?
                this.phase === Phase.BEFORE_PROCESS :
                this.phase === Phase.BEFORE_PROCESS || this.phase === Phase.MANUAL_IDLE;
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
            return this.levelState.commonAssetRelativePaths.imgCorrect;
        }        
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let step = this.stepState.step;

        step.getDescription(this.store)
        .then(result => {
            this.description = result;
        });
    },
    mounted: function() {
        if (this.stepState.state.processState === stepConfig.ProcessState.PROCESSING) {
            if (this.stepState.step.isAutoStart) {
                this.phase = Phase.AUTO_RUN;
                this.autoProcess();
            }
            else {
                this.phase = Phase.MANUAL_IDLE;
            }
        }
    },
    watch: {
        processState: function(val, oldVal) {
            if (val === stepConfig.ProcessState.PROCESS_COMPLETE) {
                this.store.unblock(this.stepKey);
            }
            else if (val === stepConfig.ProcessState.PROCESSING) {
                if (this.stepState.step.isAutoStart) {
                    this.phase = Phase.AUTO_RUN;
                    this.autoProcess();
                }
                else {
                    this.phase = Phase.MANUAL_IDLE;
                }
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

            this.stepState.step.takeAction(this.store, this.stepKey)
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
            this.stepState.step.takeAction(this.store, this.stepKey)
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

    <span class="title">{{description}}</span>

    <div class="processing-box">
        {{statusDescription}}

        <button 
            v-on:click="process"
            v-bind:disabled="!canRunManually"
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
        Current Phase: {{phase}}
    </div>
</div>`
}