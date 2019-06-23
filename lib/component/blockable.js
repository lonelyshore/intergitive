'use strict';

const store = require('../store');

exports = module.exports = {
    computed: {
        isBlocked: function() {
            return store.state.stepStates[this.stepKey].state.isBlocked;
        }
    },
    props: {
        stepKey: String,
    },
    template: `
<div v-bind:blocked="isBlocked">
    <slot></slot>
</div>
`
}