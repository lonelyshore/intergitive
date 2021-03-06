<template>
    <div class="level-block descriptive" v-bind:class="[mode]">
        <span class="title">{{title}}</span>
        <div class="content" v-html="content"></div>
        <div class="processing-box" v-if="needConfirm">
            <button v-on:click="confirm" v-if="!isConfirmed">
                {{confirmButtonText}}
            </button>
            <img class="inline-img" v-if="isConfirmed" v-bind:src="correctImagePath">
        </div>
    </div>
</template>

<script>
'use strict';

const stepConfig = require('../../../common/config-step');

exports = module.exports = {
    data: function() {
        return  {
            content: "",
            mode: "",
            title: "",
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
        isConfirmed: function() {
            return this.processState === stepConfig.ProcessState.PROCESS_COMPLETE;
        },
        confirmButtonText: function() {
            return this.levelState.terms.buttonConfirmText;
        },
        correctImagePath: function() {
            return this.levelState.commonAssetRelativePaths.imgCorrect;
        },
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let stepState = this.levelState.stepStates[this.stepKey];
        let descriptiveStep = stepState.step;
        
        this.mode = descriptiveStep.mode;
        this.title = this.store.state.levelState.terms[this.mode];

        return this.store.loadText(descriptiveStep.descriptionId)
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
    }
};
</script>