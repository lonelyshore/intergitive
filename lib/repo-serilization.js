"use strict";

const git = require('./git-kit');

class SerializedTime {
    /**
     * 
     * @param {git.IndexTime} indexTime 
     */
    constructor(indexTime) {
        this.seconds = indexTime.seconds();
        this.nanoseconds = indexTime.nanoseconds();
    }

    createIndexTime() {
        let ret = new IndexTime();
        ret.nanoseconds = this.nanoseconds;
        ret.seconds = this.seconds;
        return ret;
    }
}



class SerializedIndexEntry {

    static castFromObject(obj) {
        obj.__proto__ = SerializedIndexEntry.prototype;
        obj.mtime.__proto__ = SerializedTime.prototype;
        obj.ctime.__proto__ = SerializedTime.prototype;
        return obj;
    }

    constructor(entry) {
        Object.assign(this, entry);

        this.id = entry.id.tostrS();

        this.mtime = new SerializedTime(entry.mtime);
        this.ctime = new SerializedTime(entry.ctime);
    }

    createIndexEntry() {
        let ret = Object.assign({}, this);
        ret.ctime = this.ctime.createIndexTime();
        ret.mtime = this.mtime.createIndexTime();
        ret.id = git.Oid.fromString(this.id);

        ret.__proto__ = git.IndexEntry.prototype;

        return ret;
    }
}

exports.SerializedTime = SerializedTime;

exports.SerializedIndexEntry = SerializedIndexEntry;

/**
 * @param {git.Index} index
 * @returns {string}
 */
exports.seriailzeIndex = function(index) {
    
    let serializedIndex = index.entries().map((entry) => {
        return new SerializedIndexEntry(entry);
    });
    
    return JSON.stringify(serializedIndex);
};

/**
 * 
 * @param {string} dataString
 * @returns {Array<SerializedIndexEntry>}
 */
exports.deserializedIndex = function(dataString) {
    let arr = JSON.parse(dataString);

    return arr.map((obj) => {
        return SerializedIndexEntry.castFromObject(obj);
    });
}