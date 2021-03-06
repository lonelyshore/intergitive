'use strict';

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

class ProgressData {
    constructor(courseName) {
        this.courseName = courseName;
        this.progress = {};
    }
}

module.exports.ProgressData = ProgressData;
module.exports.ProgressEnum = ProgressEnum;