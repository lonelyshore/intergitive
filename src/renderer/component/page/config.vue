<template>
    <div>
        <ul class="list-group list-group-flush">
            <li class="list-group-item">
                <div class="row justify-content-center">
                    <div class="col align-self-center">
                        {{courseNameLabel}}
                    </div>
                    <div class="col align-self-center">
                        <div class="dropdown" :class="{'show': courseOpen}">
                            <button class="btn btn-secondary dropdown-toggle" type="button" @click="courseOpen = !courseOpen" @blur="courseOpen = false">
                                {{currentCourseName}}
                            </button>
                            <ul class="dropdown-menu" :class="{'show': courseOpen}">
                                <li v-for="courseOption in courseOptions" :key="courseOption"><a class="dropdown-item" @click="setCourseName(courseOption)">{{courseOption}}</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </li>
            <li class="list-group-item">
                <div class="row justify-content-center">
                    <div class="col align-self-center">
                        {{languageLabel}}
                    </div>
                    <div class="col align-self-center">
                        <div class="dropdown" :class="{'show': languageOpen}">
                            <button class="btn btn-secondary dropdown-toggle" type="button" @click="languageOpen = !languageOpen" @blur="languageOpen = false">
                                {{currentLanguage}}
                            </button>
                            <ul class="dropdown-menu" :class="{'show': languageOpen}">
                                <li v-for="language in languageOptions" :key="language"><a class="dropdown-item" @click="setLanguage(language)">{{language}}</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </li>
        </ul>
        <div class="fixed-bottom">
            kerker
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
            },
            languageOpen: {
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
        languageLabel: function() {
            return this.store.levelState.terms.languageLabel;
        }
    },
    created: function() {
        this.courseOpen = false;
        this.languageOpen = false;

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
            this.updateLanguageOptions(courseName);

            if (this.languageOptions.indexOf(this.currentLanguage) < 0) {
                this.currentLanguage = this.languageOptions[0];
            }

            this.courseOpen = false;
        },
        setLanguage: function(language) {
            this.currentLanguage = language;
            this.languageOpen = false;
        }
    }
}
</script>