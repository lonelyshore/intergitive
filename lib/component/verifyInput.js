'use strict';

const store = require('../store');
const stepConfig = require('../config-step');
const Phase = stepConfig.UserDrivenProcessPhase;

exports = module.exports = {
    data: function() {
        return {
            description: '',
            input: '',
            phase: Phase.IDLE
        };
    },
    computed: {
        placeholder: function() {
            return store.state.terms.verifyInputPlaceholder;
        },
        submitText: function() {
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

                if (renderStepIndex !== 0 && !this.stepState.step.descriptionId) {
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
        isButtonDisabled: function() {
            return this.phase === Phase.RUNNING;
        },
        isInputCorrect: function() {
            return this.phase === Phase.SUCCESS;
        },
        correctImagePath: function() {
            return store.state.commonAssetRelativePaths.img_correct;
        }
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let verifyInputStep = this.stepState.step;

        if (verifyInputStep.descriptionId) {
            store.loadText(verifyInputStep.descriptionId)
            .then(text => {
                return store.processAssetIdInText(text);
            })
            .then(text => {
                this.description = text;
            })
        }

        this.phase = Phase.IDLE;
    },
    watch: {
        processState: function(val, oldVal) {
            if (val === stepConfig.ProcessState.PROCESS_COMPLETE) {
                store.unblock(this.stepKey);
            }
            else if (val === stepConfig.ProcessState.PROCESSING
                || val === stepConfig.ProcessState.PREPARE_PROCESS) {
                this.phase = Phase.IDLE;
            }
        }
    },    
    methods: {
        submit: function(event) {

            if (this.phase === Phase.RUNNING) {
                return;
            }

            this.phase = Phase.RUNNING;

            store.verifyInputAnswer(this.stepKey, this.input)
            .then(success => {
                if (success) {
                    this.phase = Phase.SUCCESS; 
                    store.markProcessComplete(this.stepKey);
                }
                else {
                    this.phase = Phase.FAILED;
                }
            })
            .catch(error => {
                this.phase = Phase.FAILED;
                console.error(error);
            });

        }
    },
    template: `
<div class="level-block verify" v-bind:appending="appending">
    <div v-html="description"></div>

    <div class="processing-box">
        <input 
            v-model="input"
            v-bind:placeholder="placeholder"
            v-bind:disabled="isInputCorrect" />

        <button 
            drift-right
            v-on:click="submit"
            v-bind:disabled="isButtonDisabled"
            v-if="!isInputCorrect">
            {{submitText}}
        </button>

        <img 
            drift-right
            class="inline-img"
            v-if="isInputCorrect"
            v-bind:src="correctImagePath">
        </img>
    </div>

    <div v-if="isDebug">
        Current Phase: {{phase}}
    </div>
</div>`
}