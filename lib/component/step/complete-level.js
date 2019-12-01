'use strict';

const stepConfig = require('../../config-step');

exports = module.exports = {
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
        incompleteDescription: function() {
            return this.levelState.terms.preCompleteLevelDescription;
        },
        completeDescription: function() {
            return this.levelState.terms.completeLevelDescription;
        },
        buttonConfirmText: function() {
            return this.levelState.terms.buttonConfirmText;
        },
        isDebug: function() {
            return this.levelState.isDebug;
        },
        isEnabled: function() {
            return this.stepState.state.processState === stepConfig.ProcessState.PROCESSING;
        }
    },
    props: {
        stepKey: String,
    },
    watch: {
        processState: function(val, oldVal) {
            if (val === stepConfig.ProcessState.PROCESS_COMPLETE) {
                this.store.completeLevel();
            }
        }
    },    
    methods: {
        onClick: function(event) {
            this.store.markProcessComplete(this.stepKey);
        }
    },
    template: `
<div class="level-block complete">

    <span class="processing-box">
        <span v-if="isEnabled">{{ completeDescription }}</span>
        <span v-else>{{ incompleteDescription }}</span>

        <button 
            v-on:click="onClick"
            v-bind:disabled="!isEnabled">
            {{ buttonConfirmText }}
        </button>
    </span>
</div>`
}