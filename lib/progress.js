'use strict';

const fs = require('fs-extra');
const path = require('path');

const readonly = require('./readonly');

let ProgressEnum = {
    COMPLETED: Symbol('completed'),
    UNLOCKED: Symbol('unlocked'),
    LOCKED: Symbol('locked'),

    /**
     * 
     * @param {Symbol} progressEnum 
     */
    ToStringLiteral: function(progressEnum) {
        switch(progressEnum) {
            case this.COMPLETED:
            case this.UNLOCKED:
            case this.LOCKED:
                return progressEnum.toString().slice(7, -1);
        }
    }
};

ProgressEnum = readonly.wrap(ProgressEnum);

class CourseProgress {

    static create(progressPath) {
        return Promise.resolve(new CourseProgress(progressPath))
        .then(courseProgress => {
            return fs.readJSON(progressPath)
            .catch(err => {
                console.warn(err);
                return {};
            })
            .then(progress => {
                courseProgress.progress = progress;
                return courseProgress;
            });
        });
    }

    constructor(progressPath) {
        this.progress = {};
        this.progressPath = progressPath;
    }

    isItemComplete(id) {
        return this.progress[id] === true;
    }

    setItemComplete(id) {
        this.progress[id] = true;
        return fs.writeJSON(this.progressPath, this.progress);
    }
}

class ProgressProvider{
    constructor(progressBasePath) {
        this.courseProgresses = {}
        this.progressBasePath = progressBasePath;
    }

    /**
     * 
     * @param {string} courseName 
     * @returns {Promise<CourseProgress>}
     */
    getProgress(courseName) {
        if (courseName in this.courseProgresses) {
            return Promise.resolve(this.courseProgresses[courseName]);
        }
        else {
            return fs.ensureDir(this.progressBasePath)
            .then(() => {
                return CourseProgress.create(
                    path.join(this.progressBasePath, courseName)
                );
            })
            .then(courseProgress => {
                this.courseProgresses[courseName] = courseProgress;
                return courseProgress; 
            });
        }
    }
}

module.exports.CourseProgress = CourseProgress;
module.exports.ProgressProvider = ProgressProvider;
module.exports.ProgressEnum = ProgressEnum;