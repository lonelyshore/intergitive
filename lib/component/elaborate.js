'use strict';

const store = require('../store');
const steps = require('../config-step');

exports = module.exports = {
    data: function() {
        return {
            content: ""
        };
    },
    computed: {
        title: function() {
            return store.state.terms.elaborate;
        },
    },
    props: {
        stepsKey: String,
    },
    created: function() {
        let elaborateStep = store.state.steps[this.stepsKey];

        return store.loadText(elaborateStep.descriptionId)
        .then(text => {
            this.content = text;
        });
    },
    template: `
<div class="elaborate">
    <span class="title">{{ title }}</span>
    <div class=>{{ content }}</p>
</div>`
};