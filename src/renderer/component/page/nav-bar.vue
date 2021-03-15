<template>
    <div class="nav-bar">
        <img class="back" v-on:click="clickBack" v-if="canBackward" src="static/images/left_arrow_white.svg" />
        <span class="title">{{ title }}</span>
        <img class="gear" v-on:click="openConfig" v-if="canShowConfig" src="static/images/gear.svg">
    </div>  
</template>

<script>
'use strict';

exports = module.exports = {
    data: function() {
        return {
            title: '',
            loadedKey: ''
        };
    },
    props: {
        pageState: {
            type: Object,
            required: true
        }
    },
    computed: {
        store: function() {
            return this.$root.$data.store;
        },
        displayingNode: function () {
            return this.pageState.displayingNode;
        },
        canBackward: function() {
            return this.displayingNode.parent !== null;
        },
        canShowConfig: function() {
            return true;
        }
    },
    watch: {
        displayingNode: function(val, oldVal) {
            this.reloadTitle(val.nameKey);
        }
    },
    created: function() {
        this.reloadTitle(this.pageState.displayingNode.nameKey);
    },
    methods: {
        clickBack: function(event) {
            this.store.navigate(this.pageState.displayingNode.parent);
        },
        reloadTitle: function(key) {
            this.loadedKey = key;

            let localLoadedKey = key;

            this.store.loadText(key)
            .then(text => {
                if (this.loadedKey === localLoadedKey) { // To avoid frequently page switching
                    this.title = text;
                }
            });
        },
        openConfig: function() {
            this.store.openConfig();
        }
    }
};
</script>