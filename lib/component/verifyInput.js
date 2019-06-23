'use strict';

const store = require('../store');

exports = module.exports = {
    data: function() {
        return {
            describe: '',
        };
    },
    computed: {
        stepState: function() {
            return store.state.stepStates[this.stepKey];
        },
        phase: function() {
            return this.stepState.state.phase.current;
        }
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let verifyInputStep = this.stepState.step;
    },
    template: `
<div class="level-block verify">
</div>`
}