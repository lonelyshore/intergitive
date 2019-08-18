'use strict';

let components = Object.assign({}, require('../step-components'));
components = Object.assign(components, require('../common-components'));

exports = module.exports = {
    props: {
        levelState: {
            type: Object,
            required: true
        }
    },
    computed: {
        renderSteps: function () {
          return this.levelState.stepsReady ? this.levelState.renderSteps : [];
        },
        stepStates: function () {
          return this.levelState.stepsReady ? this.levelState.stepStates : {};
        }
    },
    components: components,
    template: `
<div class="level" v-bind:non-interactable="!levelState.interactable">
    <div
        v-for="(stepKey) in renderSteps"
        is="blockable"
        v-bind:step-key="stepKey"
        v-bind:key="\`blockable-\${stepKey}\`">
        <div          
        v-bind:is="stepStates[stepKey].step.componentType"
        v-bind:step-key="stepKey"
        v-bind:key="\`level-step-\${stepKey}\`"
        ></div>
    </div>
</div>    
`
};