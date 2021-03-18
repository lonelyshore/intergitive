'use strict'

const courseMenuList = require('./menu/course-menu-list.vue').default
const nestedCoursePreview = require('./menu/nested-course-item-preview.vue').default
const levelPreview = require('./menu/level-preview.vue').default

exports = module.exports = {
  'course-menu-list': courseMenuList,
  'nested-course-item-preview': nestedCoursePreview,
  'level-preview': levelPreview
}
