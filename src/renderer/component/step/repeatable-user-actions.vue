<template>
    <div class="level-block verify">

        <span>{{description}}</span>

        <div class="processing-box">
            {{status}}: {{statusDescription}}
            <button v-on:click="process" v-bind:disabled="isRunning">
                {{buttonText}}
            </button>
        </div>

        <div v-if="isDebug">
            Current Phase: {{phase}}
        </div>
    </div>
</template>

<script>
'use strict';

const readonly = require('../../../common/readonly');
const stepConfig = require('../../../common/config-step');


let PHASE = {
    READY: Symbol('ready'),
    FAILED: Symbol('failed'),
    RUNNING: Symbol('running')
};

PHASE = readonly.wrap(PHASE);

exports = module.exports = {
    data: function() {
        return {
            phase: PHASE.READY,
            description: '',
        }
    },
    computed: {
        store: function() {
            return this.$root.$data.store;
        },
        levelState: function() {
            return this.store.state.levelState;
        },
        status: function() {
            return this.levelState.terms.operationStatus;
        },
        statusDescription: function() {
            switch(this.phase) {
                case PHASE.READY:
                    return this.levelState.terms.operationReady;

                case PHASE.RUNNING:
                    return this.levelState.terms.operationRunning;

                case PHASE.FAILED:
                    return this.levelState.terms.operationFailed;

                default:
                    return `Please translate for ${this.phase}`;
            }
        },
        stepState: function() {
            return this.levelState.stepStates[this.stepKey];
        },
        isReady: function() {
            return this.phase === PHASE.operationReady;
        },
        isRunning: function() {
            return this.phase === PHASE.RUNNING;
        },
        isFailed: function() {
            return this.phase === PHASE.FAILED;
        },
        buttonText: function() {
            return this.levelState.terms.startOperationButton;
        },
        isDebug: function() {
            return this.levelState.isDebug;
        },
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let step = this.stepState.step;

        step.getDescription(this.store)
        .then(result => {
            this.description = result;
        });
    },
    methods: {
        process: function(event) {

            if (this.phase === PHASE.RUNNING) {
                return;
            }

            this.phase = PHASE.RUNNING;

            this.stepState.step.takeAction(this.store, this.stepKey)
            .then(result => {
                if (result) {
                    this.phase = PHASE.READY;
                }
                else {
                    this.phase = PHASE.FAILED;
                }
            });
        },
    }
}
</script>