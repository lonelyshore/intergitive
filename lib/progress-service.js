'use strict';

const fs = require('fs-extra');
const path = require('path');
const paths = require('./paths');
const { ProgressData } = require('../common/progress');

class ProgressService{

    static create(courseName, progressPath) {
        return Promise.resolve(new ProgressData(courseName))
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

    constructor(progressBasePath) {
        this.courseProgresses = {}
        this.progressBasePath = progressBasePath;
    }

    /**
     * 
     * @param {string} courseName 
     */
    getProgressPath(courseName) {
        return path.join(this.progressBasePath, courseName);
    }

    /**
     * 
     * @param {string} courseName 
     * @returns {Promise<ProgressData>}
     */
    getProgress(courseName) {
        if (courseName in this.courseProgresses) {
            return Promise.resolve(this.courseProgresses[courseName]);
        }
        else {
            return fs.ensureDir(this.progressBasePath)
            .then(() => {
                return ProgressService.create(
                    courseName,
                    this.getProgressPath(courseName)
                );
            })
            .then(courseProgress => {
                this.courseProgresses[courseName] = courseProgress;
                return courseProgress; 
            });
        }
    }

    /**
     * 
     * @param {ProgressData} progressData 
     */
    setProgress(progressData) {
        this.courseProgresses[progressData.courseName] = progressData;
        return fs.writeJSON(this.getProgressPath(progressData.courseName), progressData);
    }
}

exports = module.exports = new ProgressService(paths.progressPath);