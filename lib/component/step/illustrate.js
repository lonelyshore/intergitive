'use strict';

exports = module.exports = {
    data: function() {
        return  {
            content: ""
        };
    },
    computed: {
        store: function() {
            return this.$root.$data.store;
        },
        levelState: function() {
            return this.store.state.levelState;
        },        
        title: function() {
            return this.levelState.terms.illustrate;
        },
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let stepState = this.levelState.stepStates[this.stepKey];
        let illustrateStep = stepState.step;

        return this.store.loadText(illustrateStep.descriptionId)
        .then(text => {
            return this.store.processAssetIdInText(text);
        })
        .then(text => {
            return this.store.processMarkdown(text);
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