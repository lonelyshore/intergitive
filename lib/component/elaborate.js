'use strict';

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
            return this.store.state.levelState;
        },
        title: function() {
            return this.levelState.terms.elaborate;
        },
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let stepState = this.levelState.stepStates[this.stepKey];
        let elaborateStep = stepState.step;

        this.store.loadText(elaborateStep.descriptionId)
        .then(text => {
            return this.store.processMarkdown(text);
        })
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