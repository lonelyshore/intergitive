<template>
    <div class="section">
        <course-menu-list v-bind:children="children"></course-menu-list>
    </div>        
</template>

<script>
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
   components: components
};
</script>