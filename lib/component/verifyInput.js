'use strict';

const store = require('../store');
const stepConfig = require('../config-step');

exports = module.exports = {
    data: function() {
        return {
            description: '',
            input: ''
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
        phase: function() {
            return this.stepState.state.phase.current;
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
    },
    methods: {
        submit: function(event) {
            store.verifyInputAnswer(this.stepKey, this.input);
        }
    },
    template: `
<div class="level-block verify" v-bind:appending="appending">
    <div v-html="description"></div>
    <input v-model="input" v-bind:placeholder="placeholder"/>
    <button v-on:click="submit">{{submitText}}</button>
    Current Phase: {{phase}}
</div>`
}