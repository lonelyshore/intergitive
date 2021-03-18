'use strict'

const { NamedCourseItem } = require('../common/config-course')

const Vue = require('vue')
const store = require('./store')

const page = require('./component/page-components')
const navBar = require('./component/page/nav-bar.vue').default

require('bootstrap/dist/css/bootstrap.min.css')

const app = new Vue({
  el: '#main',
  data: {
    store: store
  },
  computed: {
    currentPage: function () {
      return this.store.courseState.isReady ? this.store.state.pageState.displayingNode : null
    }
  },
  created: function () {
    Promise.resolve()
      .then(() => this.store.initialize())
      .then(() => this.store.loadTerms())
      .then(() => {
        return this.store.loadCommonAssetRelativePaths()
      })
      .then(() => {
        return this.store.loadCourse()
      })
      .then(() => {
        this.store.navigate(this.store.courseState.courseTree)
      })
  },
  render (h) {
    if (this.currentPage !== null) {
      if (this.currentPage instanceof NamedCourseItem) {
        return h(
          'div',
          [
            h(
              navBar,
              {
                props: {
                  pageState: this.store.state.pageState
                }
              }
            ),
            h(
              page[this.currentPage.renderComponent],
              {
                props: {
                  levelState: this.store.state.levelState,
                  courseState: this.store.state.courseState,
                  pageState: this.store.state.pageState
                }
              }
            )
          ]
        )
      } else {
        return h(page[this.currentPage.renderComponent])
      }
    } else {
      return h('div')
    }
  }
})
