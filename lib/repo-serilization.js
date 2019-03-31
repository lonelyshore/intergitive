"use strict";

const git = require('git-kit');

class SerializedTime {
    /**
     * 
     * @param {git.IndexTime} indexTime 
     */
    constructor(indexTime) {
        this.seconds = indexTime.seconds();
        this.nanoseconds = indexTime.nanoseconds();
    }
}

class SerializedIndexEntry {
    constructor(entry) {
        Object.assign(this, entry);

        this.id = entry.id.tostrS();

        this.mtime = new SerializedTime(entry.mtime);
        this.ctime = new SerializedTime(entry.ctime);
    }
}

/**
 * @param {git.Index} index
 */
exports.seriailzeIndex = function(index) {
    
    let serializedIndex = index.entries().map((entry) => {
        return new SerializedIndexEntry(entry);
    });
    
    return JSON.stringify(serializedIndex);
};