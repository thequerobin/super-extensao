import { i18n } from './native/I18n'
/* global chrome browser */

const ChromePromise = (function(root) {
  'use strict'
  var push = Array.prototype.push,
    hasOwnProperty = Object.prototype.hasOwnProperty

  function ChromePromise(chrome, Promise) {
    chrome = chrome || root.chrome
    Promise = Promise || root.Promise

    var runtime = chrome.runtime

    fillProperties(chrome, this)

    /// /////////////

    function setPromiseFunction(fn, thisArg) {
      return function() {
        var args = arguments

        return new Promise(function(resolve, reject) {
          const callback = (function() {
            return function callback(runtime, resolve, reject, ...args) {
              var err = runtime.lastError
              if (err) {
                reject(err)
              } else {
                resolve.apply(null, args)
              }
            }
          })()

          push.call(args, callback.bind(null, runtime, resolve, reject))

          fn.apply(thisArg, args)
        })
      }
    }

    function fillProperties(source, target) {
      for (var key in source) {
        if (hasOwnProperty.call(source, key)) {
          var val = source[key]
          var type = typeof val

          if (type === 'object' && !(val instanceof ChromePromise) && key.indexOf('on') !== 0) {
            target[key] = {}
            fillProperties(val, target[key])
          } else if (type === 'function') {
            target[key] = setPromiseFunction(val, source)
          } else {
            target[key] = val
          }
        }
      }
    }
  }

  return ChromePromise
})(typeof window !== 'undefined' ? window : self)

let b
if (typeof chrome !== 'undefined') {
  b = new ChromePromise(chrome, Promise)
  b.alarms = chrome.alarms // Don't promisify alarms -- don't make sense, yo!
  b.browserAction = chrome.browserAction // apparently, they provide no callbacks for these
  b.action = chrome.action // apparently, they provide no callbacks for these
  b.i18n = chrome.i18n
} else {
  b = browser
}

const originalLocal = b.storage.local
const originalSync = b.storage.sync
const prefix = 'superSync:'
function scopedStorage(area) {
  return {
    async get(keys = null) {
      let request = keys
      if (typeof keys === 'string') request = prefix + keys
      else if (Array.isArray(keys)) request = keys.map(key => prefix + key)
      else if (keys) request = Object.fromEntries(Object.entries(keys).map(([key,value]) => [prefix + key,value]))
      const values = await area.get(request)
      return Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith(prefix)).map(([key,value]) => [key.slice(prefix.length),value]))
    },
    set(values) { return area.set(Object.fromEntries(Object.entries(values).map(([key,value]) => [prefix + key,value]))) },
    remove(keys) { return area.remove((Array.isArray(keys) ? keys : [keys]).map(key => prefix + key)) },
    async clear() { const all = await area.get(null); return area.remove(Object.keys(all).filter(key => key.startsWith(prefix))) },
    getBytesInUse(keys) { return area.getBytesInUse(keys ? (Array.isArray(keys) ? keys : [keys]).map(key => prefix + key) : null) }
  }
}
b.storage.local = scopedStorage(originalLocal)
b.storage.sync = scopedStorage(originalSync)
const changesEvent = b.storage.onChanged
const listeners = new Map()
b.storage.onChanged = {
  addListener(listener) {
    const wrapped = (changes,area) => {
      const selected = Object.fromEntries(Object.entries(changes).filter(([key]) => key.startsWith(prefix)).map(([key,value]) => [key.slice(prefix.length),value]))
      if (Object.keys(selected).length) listener(selected,area)
    }
    listeners.set(listener,wrapped); changesEvent.addListener(wrapped)
  },
  removeListener(listener) { const wrapped=listeners.get(listener);if(wrapped)changesEvent.removeListener(wrapped);listeners.delete(listener) }
}
b.i18n = { getMessage: (name,substitutions) => i18n.getMessage(name,substitutions), getUILanguage: () => i18n.getLocale() }
export default b
