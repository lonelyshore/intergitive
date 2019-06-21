'use strict';

const store = require('../store');

exports = module.exports = {
    data: function() {
        return  {
            content: ""
        };
    },
    computed: {
        title: function() {
            return store.state.terms.illustrate;
        },
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let stepState = store.state.stepStates[this.stepKey];
        let illustrateStep = stepState.step;

        return store.loadText(illustrateStep.descriptionId)
        .then(text => {
            return store.processAssetIdInText(text);
        })
        .then(text => {
            this.content = text;
        })
    },
    template: `
<div class="level-block illustrate">
    <span class="title">{{title}}</span>
    <div v-html="content"></div>
</div>`
};