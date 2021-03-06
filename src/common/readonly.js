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

module.exports.wrapComposite = function(objs, allowNew) {
    return new Proxy(objs, {
        setProperty: function(target, key, value) {
            let result = this.get(target, key);

            if (result === undefined && allowNew) {
                return target[Reflect.ownKeys(target)[0]][key] = value;
            }
            else {
                return value;
            }
        },
        get: function(target, key) {
            for (let objKey of Reflect.ownKeys(target)) {
                let obj = target[objKey];
                if (obj.hasOwnProperty(key)) {
                    return obj[key];
                }
            }
            return undefined;           
        },
        set: function(target, key, value) {
            return this.setProperty(target, key, value);
        },
        defineProperty: function(target, key) {
            return this.setProperty(target, key, value);
        },
        deleteProperty: function(target, key) {
            return false;
        },
        ownKeys: function(target) {
            let ret = [];
            for (let objKey of Reflect.ownKeys(target)) {
                let obj = target[objKey];
                ret = ret.concat(Reflect.ownKeys(obj));
            }
            return ret;
        },
        has: function(target, key) {
            for (let objKey of Reflect.ownKeys(target)) {
                if (key in target[objKey]) {
                    return true;
                }
            }

            return false;
        }
    })
}