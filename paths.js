const fs = require('fs');
const yaml = require('js-yaml');

const RuntimeCourseSettings = require('./lib/runtime-course-settings');

let rawSetting = fs.readFileSync('example-course-settings.yaml');
let courseSettings = yaml.safeLoad(rawSetting);

let baseSetting = new RuntimeCourseSettings(
    __dirname,
    courseSettings
);

module.exports = baseSetting;