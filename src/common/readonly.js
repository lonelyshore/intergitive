'use strict'

/**
 * https://stackoverflow.com/a/50771458
 */
module.exports.wrap = function (obj) {
  return new Proxy(obj, {
    setProperty: function (target, key, value) {
      if (Object.prototype.hasOwnProperty.call(target, key)) { return target[key] }
      target[key] = value
      return target[key]
    },
    get: function (target, key) {
      return target[key]
    },
    set: function (target, key, value) {
      return this.setProperty(target, key, value)
    },
    defineProperty: function (target, key) {
      return this.setProperty(target, key, null)
    },
    deleteProperty: function (target, key) {
      return false
    }
  })
}

module.exports.wrapComposite = function (objs, allowNew) {
  return new Proxy(objs, {
    setProperty: function (target, key, value) {
      const result = this.get(target, key)

      if (result === undefined && allowNew) {
        target[Reflect.ownKeys(target)[0]][key] = value
        return value
      } else {
        return value
      }
    },
    get: function (target, key) {
      for (const objKey of Reflect.ownKeys(target)) {
        const obj = target[objKey]
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          return obj[key]
        }
      }
      return undefined
    },
    set: function (target, key, value) {
      return this.setProperty(target, key, value)
    },
    defineProperty: function (target, key) {
      return this.setProperty(target, key, null)
    },
    deleteProperty: function (target, key) {
      return false
    },
    ownKeys: function (target) {
      let ret = []
      for (const objKey of Reflect.ownKeys(target)) {
        const obj = target[objKey]
        ret = ret.concat(Reflect.ownKeys(obj))
      }
      return ret
    },
    has: function (target, key) {
      for (const objKey of Reflect.ownKeys(target)) {
        if (key in target[objKey]) {
          return true
        }
      }

      return false
    }
  })
}
