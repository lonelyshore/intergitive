'use strict'

/* eslint-disable */

module.exports = function (content, map, meta) {
  const callback = this.async()
  someAsyncOperation(content, function (err, result) {
    if (err) return callback(err)
    callback(null, result, map, meta)
  })
}
