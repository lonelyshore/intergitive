'use strict';

const store = require('../store');

exports = module.exports = {
    data: function() {
        return {
            content: ""
        };
    },
    computed: {
        title: function() {
            return store.state.terms.instruct;
        },
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let stepState = store.state.stepStates[this.stepKey];
        let instructStep = stepState.step;

        return store.loadText(instructStep.descriptionId)
        .then(text => {
            return store.processMarkdown(text);
        })        
        .then(text => {
            this.content = text;
        });
    },
    template: `
<div class="level-block instruct">
    <span class="title">{{ title }}</span>
    <div v-html="content"></div>
</div>`
};