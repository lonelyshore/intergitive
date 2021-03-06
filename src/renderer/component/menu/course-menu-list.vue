<template>
    <div class="menu-list">
        <div
            v-for="(child) in children"
            v-bind:is="getPreviewComponent(child)"
            v-bind:key="child.id"
            v-bind:item="child">
        </div>
    </div>    
</template>

<script>
'use strict';

let courseConfig = require('../../../common/config-course');

exports = module.exports = {
    props: {
        children: {
            type: Array,
            required: true
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
    // Inject components beforeCreate because there is a cyclic reference (this component itself is referenced in "menu-components") and it will not resolve during the "require" stage.
    beforeCreate() {
        let components = this.$options.components || {};
        components = Object.assign(components, require('../menu-components'));
        components = Object.assign(components, require('../common-components'));
        this.$options.components = components;

    }
};
</script>