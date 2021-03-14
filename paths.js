'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CourseStruct = require('./src/main/course-struct');

const projectPath = path.resolve(__dirname);
let settingRawContent = fs.readFileSync(path.join(projectPath, 'example-course-settings.yaml'));
let relativeBasePath = yaml.safeLoad(settingRawContent).relativeBasePath;

let baseSetting = new CourseStruct(
    projectPath,
    relativeBasePath
);

module.exports = baseSetting;