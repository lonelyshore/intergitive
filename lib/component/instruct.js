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
        stepsKey: String,
    },
    created: function() {
        let renderStep = store.state.renderSteps[this.stepsKey];
        let instructStep = renderStep.step;

        return store.loadText(instructStep.descriptionId)
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