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
        stepsKey: String,
    },
    created: function() {
        let renderStep = store.state.renderSteps[this.stepsKey];
        let illustrateStep = renderStep.step;

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