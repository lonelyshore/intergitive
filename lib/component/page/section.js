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
        store: function() {
            return this.$root.$data.store;
        },
        children: function () {
            return this.pageState.displayingNode.children;
        }
    },
    created: function() {
        this.store.loadText(this.pageState.displayingNode.nameKey)
        .then(text => {
            this.title = text;
        });
    },
    methods: {
        clickBack: function(event) {
            this.store.navigate(this.pageState.displayingNode.parent);
        }
    },
    components: components,
    template: `
<div class="section">
    <div class="title-bar">
        <img class="back" v-on:click="clickBack" src="example/static/images/left_arrow_dark_blue.svg"></img>
        <span class="title">{{ title }}</span>
    </div>
    <course-menu-list v-bind:children="children"></course-menu-list>
</div>    
  `
};