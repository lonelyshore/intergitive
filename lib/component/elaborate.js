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
            return store.state.terms.elaborate;
        },
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let stepState = store.state.stepStates[this.stepKey];
        let elaborateStep = stepState.step;

        return store.loadText(elaborateStep.descriptionId)
        .then(text => {
            this.content = text;
        });
    },
    template: `
<div class="level-block elaborate">
    <span class="title">{{ title }}</span>
    <div v-html="content"></div>
</div>`
};