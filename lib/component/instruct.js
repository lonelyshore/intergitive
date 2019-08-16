'use strict';

const store = require('../store');

exports = module.exports = {
    data: function() {
        return {
            content: ""
        };
    },
    computed: {
        store: function() {
            return this.$root.$data.store;
        },
        levelState: function() {
            return this.store.levelState;
        },
        title: function() {
            return this.levelState.terms.instruct;
        },
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let stepState = this.levelState.stepStates[this.stepKey];
        let instructStep = stepState.step;

        return this.store.loadText(instructStep.descriptionId)
        .then(text => {
            return this.store.processMarkdown(text);
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