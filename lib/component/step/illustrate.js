'use strict';

const stepConfig = require('../../config-step');

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
        stepState: function() {
            return this.levelState.stepStates[this.stepKey];
        },
        processState: function() {
            return this.stepState.state.processState;
        },
        needConfirm: function() {
            return this.stepState.step.needConfirm;
        },    
        title: function() {
            return this.levelState.terms.illustrate;
        },
        confirmButtonText: function() {
            return this.levelState.terms.buttonConfirmText;
        }
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
    mounted: function() {
        this.responseToProcessState(this.processState);
    },
    watch: {
        processState: function(val, oldVal) {
            this.responseToProcessState(val);
        }
    },
    methods: {
        confirm: function(event) {
            this.store.markProcessComplete(this.stepKey);
        },
        responseToProcessState: function(processState) {
            if (processState === stepConfig.ProcessState.PROCESS_COMPLETE) {
                this.store.unblock(this.stepKey);
            }
            else if (processState === stepConfig.ProcessState.PROCESSING) {
                if (!this.needConfirm) {
                    this.store.markProcessComplete(this.stepKey);
                }
            }
        }
    },
    template: `
<div class="level-block illustrate">
    <span class="title">{{title}}</span>
    <div v-html="content"></div>
    <div class="processing-box" v-if="needConfirm">
        <button v-on:click="confirm">
            {{confirmButtonText}}
        </button>
    </div>
</div>`
};