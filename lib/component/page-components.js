'use strict';

const level = require('./page/level');
const course = require('./page/course');
const section = require('./page/section');

exports = module.exports = {
    level: level,
    course: course,
    'sequential-section': section,
    'free-access-section': section
};