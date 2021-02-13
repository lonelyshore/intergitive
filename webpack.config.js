'use strict';

const path = require('path');

const distPath = path.resolve(__dirname, 'dist');

const main = {
  entry: path.resolve(__dirname, './main.js'),
  output: {
    filename: 'main.js',
    path: distPath,
  },
  target: 'electron-main'
};

const renderer = {
  entry: path.resolve(__dirname, './lib/render-level.js'),
  output: {
    filename: 'render-level.js',
    path: distPath,
  },
  target: 'electron-renderer'
};


module.exports = [main, renderer];