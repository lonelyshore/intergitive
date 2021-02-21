'use strict';

console.warn('preload');

const { contextBridge } = require('electron');

console.warn('preload - 1');

const store = require('../lib/store');

console.warn('preload - 2');

const paths = require('./paths');

console.warn('preload - 3');

// contextBridge.exposeInMainWorld(
//     'api', {
//         getStore: () => store,
//         getPaths: () => paths,
//     }
// );

window.api = {
    getStore: () => store,
    getPaths: () => paths
}
