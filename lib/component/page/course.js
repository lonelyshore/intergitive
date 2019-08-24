'use strict';

let components = Object.assign({}, require('../menu-components'));
components = Object.assign(components, require('../common-components'));

exports = module.exports = {
    props: {
        courseState: {
            type: Object,
            required: true
        },
        pageState: {
            type: Object,
            required: true
        }
    },
    computed: {
      children: function () {
        return this.pageState.displayingNode.children;
      }
    },
    components: components,
    template: `
<div class="course">
    <course-menu-list v-bind:children="children"></course-menu-list>
</div>    
  `
};