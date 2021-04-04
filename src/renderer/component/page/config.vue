<template>
    <div>
        <div class="nav-bar">
            <span class="title">{{ title }}</span>
        </div>
        <ul class="list-group list-group-flush">
            <li class="list-group-item px-5">
              {{appVersionLabel}} - {{appVersion}}
            </li>
            <li class="list-group-item px-5">
                <div class="row justify-content-center">
                    <div class="col align-self-center">
                        {{courseNameLabel}}
                    </div>
                    <div class="col align-self-center">
                        <div class="dropdown" :class="{'show': courseOpen}">
                            <button class="btn btn-secondary dropdown-toggle" type="button" @click="courseOpen = !courseOpen">
                                {{currentCourseName}}
                            </button>
                            <ul class="dropdown-menu" :class="{'show': courseOpen}">
                                <li v-for="courseOption in courseOptions" :key="courseOption"><a class="dropdown-item" @click="setCourseName(courseOption)">{{courseOption}}</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </li>
            <li class="list-group-item px-5">
                <div class="row justify-content-center">
                    <div class="col align-self-center">
                        {{languageLabel}}
                    </div>
                    <div class="col align-self-center">
                        <div class="dropdown" :class="{'show': languageOpen}">
                            <button class="btn btn-secondary dropdown-toggle" type="button" @click="languageOpen = !languageOpen">
                                {{currentLanguage}}
                            </button>
                            <ul class="dropdown-menu" :class="{'show': languageOpen}">
                                <li v-for="language in languageOptions" :key="language"><a class="dropdown-item" @click="setLanguage(language)">{{language}}</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </li>
            <li class="list-group-item px-5">
                <div class="row justify-content-evenly">
                    <button type="button" class="col-3 btn btn-primary" @click="close(true)">
                        {{saveAndCloseLabel}}
                    </button>
                    <button type="button" class="col-3 btn btn-primary" @click="close(false)">
                        {{closeLabel}}
                    </button>
                </div>
            </li>
        </ul>
        <div class="accordion p-5" id="accordionExample">
          <div class="accordion-item">
            <h2 class="accordion-header" id="headingOne">
              <button class="accordion-button" :class="getInfoHeaderStatus(0)" type="button" :aria-expanded="`${infoEntryOpened === 0}`" aria-controls="collapseOne" @click="clickInfoEntry(0)">
                {{creditsAndLicense}}
              </button>
            </h2>
            <div class="accordion-collapse collapse" :class="getInfoEntryStatus(0)" aria-labelledby="headingOne" data-bs-parent="#accordionExample">
              <div class="accordion-body" v-html="creditsAndLicenseContent">
              </div>
            </div>
          </div>
        </div>
    </div>
</template>
<script>
'use strict'

const { ApplicationConfig } = require('../../../common/config-app')

exports = module.exports = {
  data: function () {
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
      },
      infoEntryOpened: {
        type: Number,
        default: Number.NaN
      }
    }
  },
  computed: {
    store: function () {
      return this.$root.$data.store
    },
    terms: function () {
      return this.store.levelState.terms
    },
    courseNameLabel: function () {
      return this.terms.courseNameLabel
    },
    languageLabel: function () {
      return this.terms.languageLabel
    },
    saveAndCloseLabel: function () {
      return this.terms.saveAndCloseLabel
    },
    closeLabel: function () {
      return this.terms.closeLabel
    },
    title: function () {
      return this.terms.configTitle
    },
    creditsAndLicense: function () {
      return this.terms.creditsAndLicense
    },
    creditsAndLicenseContent: function () {
      return this.store.processMarkdown(this.terms.creditsAndLicenseContent)
    },
    appVersionLabel: function () {
      return this.terms.appVersionLabel
    },
    appVersion: function () {
      return this.store.state.appVersion
    }
  },
  created: function () {
    this.courseOpen = false
    this.languageOpen = false
    this.infoEntryOpened = Number.NaN

    this.courseOptions = Object.keys(this.store.state.courseOptions)
    this.currentCourseName = this.store.appState.courseName

    this.updateLanguageOptions(this.currentCourseName)
    this.currentLanguage = this.store.appState.language
  },
  methods: {
    updateLanguageOptions: function (courseName) {
      this.languageOptions = this.store.state.courseOptions[courseName]
    },
    setCourseName: function (courseName) {
      console.log('setCourseName')
      this.currentCourseName = courseName
      this.updateLanguageOptions(courseName)

      if (this.languageOptions.indexOf(this.currentLanguage) < 0) {
        this.currentLanguage = this.languageOptions[0]
      }

      this.courseOpen = false
    },
    setLanguage: function (language) {
      this.currentLanguage = language
      this.languageOpen = false
    },
    close: function (isSaving) {
      const savedConfig = isSaving
        ? new ApplicationConfig(
          this.currentLanguage,
          this.currentCourseName
        )
        : this.store.appState

      this.store.closeConfig(savedConfig)
    },
    clickInfoEntry (entryIndex) {
      if (entryIndex === this.infoEntryOpened) {
        this.infoEntryOpened = Number.NaN
      } else {
        this.infoEntryOpened = entryIndex
      }
    },
    getInfoHeaderStatus (entryIndex) {
      return {
        collpased: this.infoEntryOpened !== entryIndex
      }
    },
    getInfoEntryStatus (entryIndex) {
      return {
        show: entryIndex === this.infoEntryOpened
      }
    }
  }
}
</script>
