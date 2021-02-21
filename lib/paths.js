const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const RuntimeCourseSettings = require('./runtime-course-settings');

const projectPath = path.resolve(__dirname, '../');
let rawSetting = fs.readFileSync(path.join(projectPath, 'example-course-settings.yaml'));
let courseSettings = yaml.safeLoad(rawSetting);

let baseSetting = new RuntimeCourseSettings(
    projectPath,
    courseSettings
);

module.exports = baseSetting;