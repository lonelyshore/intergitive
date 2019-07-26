'use strict';

const store = require('../store');
const stepConfig = require('../config-step');
const Phase = stepConfig.UserDrivenProcessPhase;

exports = module.exports = {
    data: function() {
        return {
            phase: new Phase()
        };
    },
    computed: {
        description: function() {
            return store.state.terms.verifyRepoDescription;
        },
        buttonText: function() {
            return store.state.terms.verifyInputSubmitText;
        },
        stepState: function() {
            return store.state.stepStates[this.stepKey];
        },
        appending: function() {
            if (this.stepKey === undefined) {
                return false;
            }
            else {
                let renderStepIndex = store.state.renderSteps.indexOf(this.stepKey);

                if (renderStepIndex !== 0) {
                    let previousKey = `${store.state.renderSteps[renderStepIndex - 1]}`;
                    let previousStep = store.state.stepStates[previousKey].step;
                    return previousStep instanceof stepConfig.InstructStep;
                    
                }
                else {
                    return false;
                }
            }
        },
        processState: function() {
            return this.stepState.state.processState.current;
        },
        isDebug: function() {
            return store.state.isDebug;
        },
        isRunning: function() {
            return this.phase.current === Phase.RUNNING;
        },
        isSuccess: function() {
            return this.phase.current === Phase.SUCCESS;
        },
        isFailed: function() {
            return this.phase.current === Phase.FAILED;
        },
        isIdle: function() {
            return this.phase.current === Phase.IDLE;
        },
        correctImagePath: function() {
            return store.state.commonAssetRelativePaths.img_correct;
        }
    },
    props: {
        stepKey: String,
    },
    created: function() {
        this.phase.current = Phase.IDLE;
    },
    watch: {
        processState: function(val, oldVal) {
            if (val === stepConfig.ProcessState.PROCESS_COMPLETE) {
                store.unblock(this.stepKey);
            }
            else if (val === stepConfig.ProcessState.PROCESSING
                    || val === stepConfig.ProcessState.PREPARE_PROCESS) {
                this.phase.current = Phase.IDLE;
            }
        }
    },    
    methods: {
        operate: function(event) {

            if (this.phase.current === Phase.RUNNING
                || this.phase.current === Phase.SUCCESS) {
                return;
            }

            this.phase.current = Phase.RUNNING;

            store.verifyRepoEqual(this.stepKey)
            .then(success => {
                if (success) {
                    this.phase.current = Phase.SUCCESS; 
                    store.markProcessComplete(this.stepKey);
                }
                else {
                    this.phase.current = Phase.FAILED;
                }
            });
        }
    },
    template: `
<div class="level-block verify" v-bind:appending="appending">
    <span v-if="!appending">{{ description }}</span>

    <div class="processing-box">
        <button 
            v-on:click="operate"
            v-bind:disabled="isRunning"
            v-if="!isSuccess">
            {{buttonText}}
        </button>

        <img 
            class="inline-img"
            v-if="isSuccess"
            v-bind:src="correctImagePath">
        </img>
    </div>

    <div v-if="isDebug">
        Current Phase: {{phase.current}}
    </div>
</div>`
}