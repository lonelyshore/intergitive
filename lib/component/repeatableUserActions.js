'use strict';

const store = require('../store');
const readonly = require('../readonly');
const stepConfig = require('../config-step');


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
        statusDescription: function() {
            switch(this.phase) {
                case PHASE.READY:
                    return store.state.terms.operationReady;

                case PHASE.RUNNING:
                    return store.state.terms.operationRunning;

                case PHASE.FAILED:
                    return store.state.terms.operationFailed;

                default:
                    return `Please translate for ${this.phase}`;
            }
        },
        stepState: function() {
            return store.state.stepStates[this.stepKey];
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
            return store.state.terms.startOperationButton;
        },
        isDebug: function() {
            return store.state.isDebug;
        },
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let step = this.stepState.step;

        step.getDescription(store)
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

            this.stepState.step.takeAction(store, this.stepKey)
            .then(result => {
                if (result) {
                    this.phase = PHASE.READY;
                }
                else {
                    this.phase = PHASE.FAILED;
                }
            });
        },
    },
    template: `
<div class="level-block verify">

    <span>{{description}}</span>

    <div class="processing-box">
        {{statusDescription}}
        <button drift-right v-on:click="process" v-bind:disabled="!isRunning">
            {{buttonText}}
        </button>
    </div>

    <div v-if="isDebug">
        Current Phase: {{phase.current}}
    </div>
</div>`
}