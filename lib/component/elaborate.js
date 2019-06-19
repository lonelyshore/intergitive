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
        stepsKey: String,
    },
    created: function() {
        let elaborateRenderStep = store.state.renderSteps[this.stepsKey];
        let elaborateStep = elaborateRenderStep.step;

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