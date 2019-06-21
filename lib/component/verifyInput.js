'use strict';

const store = require('../store');

exports = module.exports = {
    data: function() {
        return {
            describe: ''
        };
    },
    computed: {
    },
    props: {
        stepKey: String,
    },
    created: function() {
        let stepState = store.state.stepStates[this.stepKey];
        let verifyInputStep = stepState.step;
    },
    template: `
<div class="level-block verify">
</div>`
}