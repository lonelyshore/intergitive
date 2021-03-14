'use strict';

const fs = require('fs-extra');
const path = require('path');
const { CourseStruct } = require('./course-struct');
const { ApplicationConfig } = require('../common/config-app');

const configName = 'app-config.json';

function createDefaultConfig(){
    return new ApplicationConfig(
        'zh-Hant',
        'git-extensions'
    );
}

class AppConfigService {

    /**
     * 
     * @param {string} configDirName 
     * @param {CourseStruct} courseStruct 
     */
    constructor(configDirName, courseStruct) {
        this.configDirName = configDirName;
        this.courseStruct = courseStruct;
    }

    get configurationPath() {
        return path.join(this.configDirName, configName);
    }

    /**
     * @returns {ApplicationConfig} returns configuration. If not exists, create one.
     */
    loadConfiguration() {

        return fs.readFile(this.configurationPath)
        .then(content => {
            let obj = JSON.parse(content);
            Object.setPrototypeOf(obj, ApplicationConfig);
            return obj
        })
        .catch(err => {
            let defaultConfig = createDefaultConfig();

            return this.saveConfiguration(defaultConfig)
            .then(() => defaultConfig);
        });
    }

    /**
     * This method is for development only.
     * @returns {ApplicationConfig}
     */
    loadConfigurationSync() {

        let obj;
        try {
            let content = fs.readFileSync(this.configurationPath);
            obj = JSON.parse(content);
            Object.setPrototypeOf(obj, ApplicationConfig);
        }
        catch(error) {
            obj = createDefaultConfig();
        }
        
        return obj;
    }

    /**
     * 
     * @param {ApplicationConfig} config The configuration to be serialized
     */
    saveConfiguration(config) {
        return fs.writeFile(
            this.configurationPath,
            JSON.stringify(config)
        );
    }

    listCourseAndLanguageOptions() {
        let courses = {};
        return fs.readdir(
            this.courseStruct.courseResourcesPath,
            { withFileTypes: true})
        .then(dirents => {
            let scanCourses = dirents.reduce(
                (previous, dirent) => {
                    if (dirent.isDirectory()) {
                        let courseName = dirent.name;
                        previous = previous.then(() => 
                            scanCourse(this.courseStruct, courseName))
                        .then(langs => {
                            courses[courseName] = langs;
                        });
                    }

                    return previous;
                },
                Promise.resolve()
            );

            return scanCourses;
        })
        .then(() => courses);

        function scanCourse(courseStruct, courseName) {
            return fs.readdir(
                path.join(
                    courseStruct.courseResourcesPath,
                    courseName
                ),
                { withFileTypes: true }
            )
            .then(dirents => {
                return dirents.reduce(
                    (previous, dirent) => {
                        if (dirent.isDirectory()) {
                            previous.push(dirent.name);
                        }
                        return previous;
                    },
                    []
                );
            });
        }
    }
}

module.exports.AppConfigService = AppConfigService;