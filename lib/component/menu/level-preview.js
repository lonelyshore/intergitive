'use strict';

let courseConfig = require('../../config-course');

exports = module.exports = {
    data: function(){
        return {
            name: ""
        };
    },
    props: {
        item: {
            type: courseConfig.LevelItem,
            required: true
        }
    },
    created: function() {
        this.$root.$data.store.loadText(this.item.nameKey)
        .then(text => {
            this.name = text;
        });
    },
    methods: {
        onClick: function(event) {
            this.$root.$data.store.navigate(this.item);
        }
    },
    template: `
<div class="level-preview menu-list-entry" v-on:click="onClick">
    <span>{{ name }}</span>
</div>    
  `
};