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
            type: courseConfig.NestedNamedCourseItem,
            required: true
        }
    },
    created: function() {
        this.$root.$data.store.loadText(this.item.nameKey)
        .then(text => {
            this.name = text;
        });
    },
    template: `
<div class="nested-course-item-preview">
    <span>{{ name }}</span>
</div>    
  `
};