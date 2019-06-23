'use strict';

const store = require('../store');

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
    },
    methods: {
        submit: function(event) {
            store.verifyInputAnswer(this.stepKey, this.input);
        }
    },
    template: `
<div class="level-block verify">
    <div v-html="description"></div>
    <input v-model="input" v-bind:placeholder="placeholder"/>
    <button v-on:click="submit">{{submitText}}</button>
    Current Phase: {{phase}}
</div>`
}