const RuntimeCourseSettings = require('./lib/runtime-course-settings');

let baseSetting = new RuntimeCourseSettings(
    __dirname,
    './example'
);

module.exports = baseSetting;