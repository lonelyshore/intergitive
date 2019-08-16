'use strict';

exports = module.exports = {
    computed: {
        isBlocked: function() {
            let levelState = this.$root.$data.store.state;
            return levelState.stepStates[this.stepKey].state.isBlocked;
        }
    },
    props: {
        stepKey: String,
    },
    template: `
<div class="blockable" v-bind:blocked="isBlocked">
    <slot></slot>
</div>
`
}