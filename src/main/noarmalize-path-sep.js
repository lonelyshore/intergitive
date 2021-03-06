'use strict';

const path = require('path');
const matchSep = /\\|\//g

module.exports.posix = function(target) {
    return target.replace(matchSep, '/');
};

module.exports.win32 = function(target) {
    return target.replace(matchSep, '\\');
}

module.exports.current = function(target) {
    return target.replace(matchSep, path.sep);
}