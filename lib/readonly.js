'use strict';

/**
 * https://stackoverflow.com/a/50771458
 */
module.exports.wrap = function(obj) {
    return new Proxy(obj, {
        setProperty: function(target, key, value){
            if(target.hasOwnProperty(key))
                return target[key];
            return target[key] = value;
        },
        get: function(target, key){
            return target[key];
        },
        set: function(target, key, value){
            return this.setProperty(target, key, value);
        },
        defineProperty: function (target, key) {
            return this.setProperty(target, key, value);
        },
        deleteProperty: function(target, key) {
            return false;
        }
    })
};