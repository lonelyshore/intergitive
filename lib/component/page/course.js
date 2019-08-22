'use strict';

let components = Object.assign({}, require('../menu-components'));
components = Object.assign(components, require('../common-components'));

exports = module.exports = {
    data: function() {
        return {
            title: ''
        };
    },
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
    created: function() {
        this.$root.$data.store.loadText(this.pageState.displayingNode.nameKey)
        .then(text => {
            this.title = text;
        });
    },
    components: components,
    template: `
<div class="course">
    <div class="title">{{ title }}</div>
    <course-menu-list v-bind:children="children"></course-menu-list>
</div>    
  `
};