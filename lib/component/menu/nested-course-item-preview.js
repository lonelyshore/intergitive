'use strict';

const courseConfig = require('../../config-course');
const progress = require('../../progress');

exports = module.exports = {
    data: function(){
        return {
            name: "",
            progressStatus: "",
        };
    },
    props: {
        item: {
            type: courseConfig.NestedNamedCourseItem,
            required: true
        }
    },
    computed: {
        isDebug: function() {
            return this.$root.$data.store.state.levelState.isDebug;
        },
    },
    created: function() {
        this.$root.$data.store.loadText(this.item.nameKey)
        .then(text => {
            this.name = text;

            let progressStatus =
                this.$root.$data.store.state.courseState.courseItemIdToUnlockStatus[this.item.id];

            this.progressStatus = progress.ProgressEnum.ToStringLiteral(progressStatus);
        });
    },
    methods: {
        onClick: function(event) {
            this.$root.$data.store.navigate(this.item);
        }
    },
    template: `
<div class="nested-course-item-preview menu-list-entry" v-on:click="onClick" v-bind:progress="progressStatus">
    <span>{{ name }}</span>
    <span v-if="isDebug">{{ progressStatus }}</span>
</div>    
  `
};