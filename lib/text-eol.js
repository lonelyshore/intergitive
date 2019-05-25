'use strict'

let isCrLf = require('os').platform() === 'win32';
let systemEol = isCrLf ? '\r\n' : '\n';
let eolReg = /\r\n|\r|\n/g

/**
 * 
 * @param {string} text 
 * @param {string} targetEol
 */
function convert(text, targetEol) {
    return text.replace(eolReg, targetEol);
}

function generateConvert(targetEol) {
    return function(text) {
        return convert(text, targetEol);
    }
}

/**
 * 
 * @param {string} target 
 */
function randomConvert(target) {

    function getEolRandomly() {
        let val = Math.random();
        if (val < 0.333) {
            return '\n';
        }
        else if (val < 0.666) {
            return '\r';
        }
        else {
            return '\r\n';
        }
    }

    if (!eolReg.test(target)) {
        return target;
    }

    let lines = target.split(eolReg);
    
    let ret = lines[0];
    lines.slice(1).forEach(line => {
        ret += getEolRandomly() + line;
    });

    return ret;
}

module.exports.toSystem = generateConvert(systemEol);
module.exports.toCr = generateConvert('\r');
module.exports.toLf = generateConvert('\n');
module.exports.toCrLf = generateConvert('\r\n');
module.exports.toRandom = randomConvert;
module.exports.isCrLf = () => isCrLf;