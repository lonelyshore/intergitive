'use strict';

class ApplicationConfig {
    constructor(language, courseName) {
        this.language = language;
        this.courseName = courseName;
    }
}

module.exports.ApplicationConfig = ApplicationConfig;