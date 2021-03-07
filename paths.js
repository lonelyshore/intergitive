'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const RuntimeCourseSettings = require('./src/main/runtime-course-settings');
const { AppConfigService } = require('./src/main/app-config-service');

const projectPath = path.resolve(__dirname);
let rawSetting = fs.readFileSync(path.join(projectPath, 'example-course-settings.yaml'));
let courseSettings = yaml.safeLoad(rawSetting);

let appConfigService = new AppConfigService(
    path.join(projectPath, courseSettings.relativeBasePath)    
);

let appConfig = appConfigService.loadConfigurationSync();


let baseSetting = new RuntimeCourseSettings(
    projectPath,
    courseSettings,
    appConfig
);

module.exports = baseSetting;