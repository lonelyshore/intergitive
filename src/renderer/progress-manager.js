'use strict';

const { ProgressData } = require('../common/progress');

const api = window.api;

class ProgressInfo {

    /**
     * 
     * @param {ProgressData} data 
     */
    constructor(data) {
        this.data = data;
    }

    isItemComplete(id) {
        return this.data.progress[id] === true;
    }

    setItemComplete(id) {
        this.data.progress[id] = true;
    }
}

class ProgressManager {

    getProgress(courseName) {
        return api.invokeProgressService('getProgress', courseName)
        .then(result => {
            return new ProgressInfo(result);
        });
    }

    /**
     * 
     * @param {CourseProgress} progress 
     */
    setProgress(progress) {
        return api.invokeProgressService('setProgress', progress.data);
    }
}

module.exports.ProgressInfo = ProgressInfo;
module.exports.ProgressManager = ProgressManager;