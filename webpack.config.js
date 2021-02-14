'use strict';

const path = require('path');
const fs = require('fs-extra');
const distPath = path.resolve(__dirname, 'dist');

const main = {
  entry: path.resolve(__dirname, './main.js'),
  output: {
    filename: 'main.js',
    path: distPath,
  },
  target: 'electron-main',
  node: {
    __dirname: false,
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        loader: 'node-loader',
      },
    ],
  },
  //mode: "development"
};

const renderer = {
  entry: path.resolve(__dirname, './lib/render-level.js'),
  output: {
    filename: 'render-level.js',
    path: path.join(distPath, 'lib'),
  },
  target: 'electron-renderer'
};


module.exports = [main, renderer];

fs.ensureDir(path.resolve(__dirname, 'dist'));
fs.copyFileSync(path.resolve(__dirname, 'index.html'), path.resolve(__dirname, 'dist/index.html'));