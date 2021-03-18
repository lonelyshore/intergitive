'use strict'

/**
 * @module main/repo-serialization
 */

const git = require('./git-kit')

class SerializedTime {
  /**
     *
     * @param {git.IndexTime} indexTime
     */
  constructor (indexTime) {
    this.seconds = indexTime.seconds()
    this.nanoseconds = indexTime.nanoseconds()
  }
}

/**
 * @class
 */
class SerializedIndexEntry {
  static castFromObject (obj) {
    Object.setPrototypeOf(obj, SerializedIndexEntry.prototype)
    Object.setPrototypeOf(obj.mtime, SerializedTime.prototype)
    Object.setPrototypeOf(obj.ctime, SerializedTime.prototype)
    return obj
  }

  constructor (entry) {
    Object.assign(this, entry)

    this.id = entry.id.tostrS()

    this.mtime = new SerializedTime(entry.mtime)
    this.ctime = new SerializedTime(entry.ctime)
  }

  /**
     * @param {git.IndexEntry} entry
     */
  equals (entry) {
    return entry.id.strcmp(this.id) === 0 &&
            entry.path === this.path &&
            entry.mode === this.mode &&
            entry.flags === this.flags &&
            entry.flagsExtended === this.flagsExtended
  }

  createIndexEntry () {
    const ret = new git.IndexEntry()
    ret.dev = this.dev
    ret.fileSize = this.fileSize
    ret.flags = this.flags
    ret.flagsExtended = this.flagsExtended
    ret.gid = this.gid
    ret.ino = this.ino
    ret.mode = this.mode
    ret.path = this.path
    ret.uid = this.uid

    ret.id = git.Oid.fromString(this.id)

    return ret
  }
}

exports.SerializedTime = SerializedTime

exports.SerializedIndexEntry = SerializedIndexEntry

/**
 * @param {git.Index} index
 * @returns {string}
 */
exports.seriailzeIndex = function (index) {
  const serializedIndex = index.entries().map((entry) => {
    return new SerializedIndexEntry(entry)
  })

  return JSON.stringify(serializedIndex)
}

/**
 *
 * @param {string} dataString
 * @returns {Array<SerializedIndexEntry>}
 */
exports.deserializedIndex = function (dataString) {
  const arr = JSON.parse(dataString)

  return arr.map((obj) => {
    return SerializedIndexEntry.castFromObject(obj)
  })
}
