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
        stepsKey: String,
    },
    created: function() {
        let renderStep = store.state.renderSteps[this.stepsKey];
        let verifyInputStep = renderStep.step;
    },
    template: `
<div class="level-block verify">
</div>`
}