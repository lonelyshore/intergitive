<template>
    <div class="level-block verify" v-bind:appending="appending">
        <div class="content" v-html="description"></div>

        <div class="processing-box">
            <input 
                v-model="input"
                v-bind:placeholder="placeholder"
                v-bind:disabled="isInputCorrect" />



            <button 
                v-on:click="submit"
                v-bind:disabled="isButtonDisabled"
                v-if="!isInputCorrect">
                {{submitText}}
            </button>

            <img 
                class="inline-img"
                v-if="isInputCorrect"
                v-bind:src="correctImagePath" />
        </div>

        <span
            red-highlight
            v-if="isInputIncorrect">
            {{failedText}}
        </span>

        <div v-if="isDebug">
            Current Phase: {{phase}}
            <button
                v-on:click="skip"
                style="pointer-events: visiblePainted;">
                SKIP
            </button>
        </div>
    </div>    
</template>

<script>
'use strict';

const stepConfig = require('../../config-step');
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
        store: function() {
            return this.$root.$data.store;
        },
        levelState: function() {
            return this.store.state.levelState;
        },
        placeholder: function() {
            return this.levelState.terms.verifyInputPlaceholder;
        },
        submitText: function() {
            return this.levelState.terms.verifyInputSubmitText;
        },
        failedText: function() {
            return this.levelState.terms.verifyInputFailed;
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

                if (renderStepIndex !== 0 && !this.stepState.step.descriptionId) {
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
        isButtonDisabled: function() {
            return this.phase === Phase.RUNNING;
        },
        isInputCorrect: function() {
            return this.phase === Phase.SUCCESS;
        },
        isInputIncorrect: function() {
            return this.phase === Phase.FAILED;
        },
        correctImagePath: function() {
            return this.levelState.commonAssetRelativePaths.imgCorrect;
        }
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let verifyInputStep = this.stepState.step;

        if (verifyInputStep.descriptionId) {
            this.store.loadText(verifyInputStep.descriptionId)
            .then(text => {
                return this.store.processAssetIdInText(text);
            })
            .then(text => {
                return this.store.processMarkdown(text);
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
                this.store.unblock(this.stepKey);
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

            this.store.verifyInputAnswer(this.stepKey, this.input)
            .then(success => {
                if (success) {
                    this.phase = Phase.SUCCESS; 
                    this.store.markProcessComplete(this.stepKey);
                }
                else {
                    this.phase = Phase.FAILED;
                }
            })
            .catch(error => {
                this.phase = Phase.FAILED;
                console.error(error);
            });

        },
        skip: function(event) {

            if (this.phase === Phase.RUNNING) {
                return;
            }

            this.phase = Phase.SUCCESS; 
            this.store.markProcessComplete(this.stepKey);

        }
    }
}
</script>