'use strict';

const stepConfig = require('../config-step');
const Phase = stepConfig.UserDrivenProcessPhase;

exports = module.exports = {
    data: function() {
        return {
            phase: Phase.IDLE
        };
    },
    computed: {
        store: function() {
            return this.$root.$data.store;
        },
        levelState: function() {
            return this.store.levelState;
        },
        description: function() {
            return this.levelState.terms.verifyRepoDescription;
        },
        status: function() {
            return this.levelState.terms.operationStatus;
        },
        statusDescription: function() {
            switch(this.phase) {
                case Phase.IDLE:
                    return this.levelState.terms.operationReady;

                case Phase.RUNNING:
                    return this.levelState.terms.operationRunning;

                case Phase.FAILED:
                    return this.levelState.terms.operationFailed;

                case Phase.SUCCESS:
                    return this.levelState.terms.operationCompleted;

                default:
                    return `Please translate for ${this.phase}`;
            }
        },        
        buttonText: function() {
            return this.levelState.terms.startOperationButton;
        },
        stepState: function() {
            return this.levelState.stepStates[this.stepKey];
        },
        appending: function() {
            if (this.stepKey === undefined) {
                return false;
            }
            else {
                let renderStepIndex = this.levelState.renderSteps.indexOf(this.stepKey);

                if (renderStepIndex !== 0) {
                    let previousKey = `${this.levelState.renderSteps[renderStepIndex - 1]}`;
                    let previousStep = this.levelState.stepStates[previousKey].step;
                    return previousStep instanceof stepConfig.InstructStep;
                    
                }
                else {
                    return false;
                }
            }
        },
        processState: function() {
            return this.stepState.state.processState;
        },
        isDebug: function() {
            return this.levelState.isDebug;
        },
        isRunning: function() {
            return this.phase === Phase.RUNNING;
        },
        isSuccess: function() {
            return this.phase === Phase.SUCCESS;
        },
        isFailed: function() {
            return this.phase === Phase.FAILED;
        },
        isIdle: function() {
            return this.phase === Phase.IDLE;
        },
        correctImagePath: function() {
            return this.levelState.commonAssetRelativePaths.img_correct;
        }
    },
    props: {
        stepKey: String,
    },
    created: function() {
        this.phase = Phase.IDLE;
    },
    watch: {
        processState: function(val, oldVal) {
            if (val === stepConfig.ProcessState.PROCESS_COMPLETE) {
                this.store.unblock(this.stepKey);
            }
            else if (val === stepConfig.ProcessState.PROCESSING
                    || val === stepConfig.ProcessState.PREPARE_PROCESS) {
                this.phase = Phase.IDLE;
            }
        }
    },    
    methods: {
        operate: function(event) {

            if (this.phase === Phase.RUNNING
                || this.phase === Phase.SUCCESS) {
                return;
            }

            this.phase = Phase.RUNNING;

            this.store.verifyRepoEqual(this.stepKey)
            .then(success => {
                if (success) {
                    this.phase = Phase.SUCCESS; 
                    this.store.markProcessComplete(this.stepKey);
                }
                else {
                    this.phase = Phase.FAILED;
                }
            });
        }
    },
    template: `
<div class="level-block verify" v-bind:appending="appending">
    <div class="processing-box">
        <a v-if="!appending">{{ description }}</a>

        {{status}}: {{statusDescription}}

        <button 
            drift-right
            v-on:click="operate"
            v-bind:disabled="isRunning"
            v-if="!isSuccess">
            {{buttonText}}
        </button>

        <img 
            drift-right
            class="inline-img"
            v-if="isSuccess"
            v-bind:src="correctImagePath">
        </img>
    </div>

    <div v-if="isDebug">
        Current Phase: {{phase}}
    </div>
</div>`
}