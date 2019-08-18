'use strict';

let courseConfig = require('../../config-course');

let components = Object.assign({}, require('../menu-components'));
components = Object.assign(components, require('../common-components'));

exports = module.exports = {
    props: {
        courseState: {
            type: Object,
            required: true
        }
    },
    computed: {
      children: function () {
        return this.courseState.displayingNode.children;
      }
    },
    methods:{
        getPreviewComponent: function(child) {
            if (child instanceof courseConfig.NestedNamedCourseItem) {
                return 'nested-course-item-preview';
            }
            else if (child instanceof courseConfig.LevelItem) {
                return 'level-preview';
            }
            else {
                return '';
            }
        }
    },
    components: components,
    template: `
<div class="course">
    <div
        v-for="(child) in children"
        is="getPreviewComponent(child)"
        v-bind:key="child.id"
        v-bind:item="child">
    </div>
</div>    
  `
};