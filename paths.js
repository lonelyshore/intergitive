'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const RuntimeCourseSettings = require('./src/main/runtime-course-settings');
const { AppConfigService } = require('./src/main/app-config-service');

const projectPath = path.resolve(__dirname);
let settingRawContent = fs.readFileSync(path.join(projectPath, 'example-course-settings.yaml'));
let relativeBasePath = yaml.safeLoad(settingRawContent).relativeBasePath;

let appConfigService = new AppConfigService(
    path.join(projectPath, relativeBasePath)    
);

let appConfig = appConfigService.loadConfigurationSync();

let baseSetting = new RuntimeCourseSettings(
    path.join(projectPath, relativeBasePath),
    appConfig
);

module.exports = baseSetting;