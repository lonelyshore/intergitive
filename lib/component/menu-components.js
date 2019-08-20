'use strict';

const courseMenuList = require('./menu/course-menu-list');
const nestedCoursePreview = require('./menu/nested-course-item-preview');
const levelPreview = require('./menu/level-preview');

exports = module.exports = {
    'course-menu-list': courseMenuList,
    'nested-course-item-preview': nestedCoursePreview,
    'level-preview': levelPreview
};

