'use strict';

const { AssetLoader } = require('../../src/main/asset-loader');

module.exports = function (content, map, meta) {
    var callback = this.async();
    someAsyncOperation(content, function (err, result) {
      if (err) return callback(err);
      callback(null, result, map, meta);
    });
};