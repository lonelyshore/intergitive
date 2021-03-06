'use strict'

const isCrLf = require('os').platform() === 'win32'
const systemEol = isCrLf ? '\r\n' : '\n'
const eolReg = /\r\n|\r|\n/g

/**
 *
 * @param {string} text
 * @param {string} targetEol
 */
function convert (text, targetEol) {
  return text.replace(eolReg, targetEol)
}

function generateConvert (targetEol) {
  return function (text) {
    return convert(text, targetEol)
  }
}

module.exports.toSystem = generateConvert(systemEol)
module.exports.toCr = generateConvert('\r')
module.exports.toLf = generateConvert('\n')
module.exports.toCrLf = generateConvert('\r\n')
module.exports.eolReg = eolReg
module.exports.isCrLf = () => isCrLf
