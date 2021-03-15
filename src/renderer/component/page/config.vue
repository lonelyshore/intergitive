<template>
    <div>    
        <div class="row align-items-start">
            <div class="col">
                {{courseNameLabel}}
            </div>
            <div class="col">
                <div class="dropdown" :class="{'show': courseOpen}">
                    <button class="btn btn-secondary dropdown-toggle" type="button" @click="courseOpen = !courseOpen">
                        {{currentCourseName}}
                    </button>
                    <ul class="dropdown-menu" :class="{'show': courseOpen}">
                        <li v-for="courseOption in courseOptions" :key="courseOption"><a class="dropdown-item" @click="setCourseName(courseName)">{{courseOption}}</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</template>
<script>
'use strict';

exports = module.exports = {
    data: function() {
        return {
            courseOptions: {
                type: Array,
                default: []
            },
            languageOptions: {
                type: Array,
                default: []
            },
            currentCourseName: {
                type: String,
                default: ''
            },
            currentLanguage: {
                type: String,
                default: ''
            },
            courseOpen: {
                type: Boolean,
                default: false
            }
        }
    },
    computed: {
        store: function() {
            return this.$root.$data.store;
        },
        courseNameLabel: function() {
            return this.store.levelState.terms.courseNameLabel;
        },
    },
    created: function() {
        this.courseOpen = false;
        
        this.courseOptions = Object.keys(this.store.state.courseOptions);
        this.currentCourseName = this.store.appState.courseName;

        this.updateLanguageOptions(this.currentCourseName);
        this.currentLanguage = this.store.appState.language;
    },
    methods: {
        updateLanguageOptions: function(courseName) {
            this.languageOptions = this.store.state.courseOptions[courseName];
        },
        setCourseName: function(courseName) {
            this.currentCourseName = courseName;
            updateLanguageOptions(courseName);

            if (this.languageOptions.indexOf(this.currentLanguage) < 0) {
                this.currentLanguage = this.languageOptions[0];
            }

            this.courseOpen = false;
        },
        setLanguage: function(language) {
            this.currentLanguage = language;
        }
    }
}
</script>