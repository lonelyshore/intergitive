'use strict';

module.exports.wait = function(milliseconds) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), milliseconds);
    });
}

module.exports.assert = function(value, message) {

    message = message || 'assertion failed';

    console.assert(value, message);

    if (!value && process.env.NODE_ENV === 'production') {
        throw new Error(message);
    }
}

module.exports.typeCheck = {

    isString: function(obj) {
        return typeof obj === 'string' || obj instanceof String;
    },
    
    isBool: function(obj) {
        return typeof(obj) === 'boolean';
    },

    isNumber: function(obj) {
        return typeof(obj) === 'number';
    },

    isArray: function(obj) {
        return Array.isArray(obj);
    }
    

}