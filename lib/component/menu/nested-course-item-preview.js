'use strict';

let courseConfig = require('../../config-course');

exports = module.exports = {
    data: function(){
        return {
            name: "",
            status: "",
        };
    },
    props: {
        item: {
            type: courseConfig.NestedNamedCourseItem,
            required: true
        }
    },
    created: function() {
        this.$root.$data.store.loadText(this.item.nameKey)
        .then(text => {
            this.name = text;
            this.status = this.$root.$data.store.state.courseState.courseItemIdToUnlockStatus[this.item.id];
        });
    },
    methods: {
        onClick: function(event) {
            this.$root.$data.store.navigate(this.item);
        }
    },
    template: `
<div class="nested-course-item-preview menu-list-entry" v-on:click="onClick">
    <span>{{ name }}; {{ status }}</span>
</div>    
  `
};