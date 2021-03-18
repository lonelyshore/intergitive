'use strict'

const level = require('./page/level.vue').default
const course = require('./page/course.vue').default
const section = require('./page/section.vue').default
const config = require('./page/config.vue').default

exports = module.exports = {
  level: level,
  course: course,
  'sequential-section': section,
  'free-access-section': section,
  config: config
}
