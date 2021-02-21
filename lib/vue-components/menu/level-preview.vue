<template>
    <div class="level-preview menu-list-entry" v-on:click="onClick" v-bind:progress="progressStatusValue">
        <span>{{ name }}</span>
        <span v-if="isDebug">{{ progressStatusValue }}</span>
    </div>        
</template>

<script>
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
            type: courseConfig.LevelItem,
            required: true
        }
    },
    computed: {
        isDebug: function() {
            return this.$root.$data.store.state.levelState.isDebug;
        },
        progressStatusValue: function() {
            return progress.ProgressEnum.ToStringLiteral(this.progressStatus);
        }
    },
    created: function() {
        this.$root.$data.store.loadText(this.item.nameKey)
        .then(text => {
            this.name = text;
            this.progressStatus =
                this.$root.$data.store.state.courseState.courseItemIdToUnlockStatus[this.item.id];
        });
    },
    methods: {
        onClick: function(event) {
            if (this.progressStatus !== progress.ProgressEnum.LOCKED || this.isDebug)
                this.$root.$data.store.navigate(this.item);
        }
    }
};
</script>