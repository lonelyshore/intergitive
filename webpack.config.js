'use strict';

const path = require('path');
const fs = require('fs-extra');
const { IgnorePlugin } = require('webpack');
const distPath = path.resolve(__dirname, 'dist');

const base = {
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
  plugins: [
    new IgnorePlugin(/build\/Debug\/nodegit.node$/i)
  ],
  // externals: [
  //   function(context, request, callback) {
  //     if(/^nodegit/.test(request))
  //       return callback(null, 'commonjs' + " " + request);
  //     callback();
  //   },
  // ]
}

const main = Object.assign(
  {
    entry: [
      path.resolve(__dirname, './main.js'),
      
    ],
    output: {
      filename: 'main.js',
      path: distPath,
    },
    target: 'electron-main'
  }, 
  base
);

const preload = Object.assign(
  {
    entry: [
      path.resolve(__dirname, './src/preload.js'),
    ],
    output: {
      filename: 'preload.js',
      path: path.resolve(distPath, './src'),
    },
    target: 'electron-preload'
  },
  base
);

const renderer = Object.assign(
  {
    entry: path.resolve(__dirname, './lib/render-level.js'),
    output: {
      filename: 'render-level.js',
      path: path.join(distPath, 'lib'),
    },
    target: 'electron-renderer'
  },
  base
);


module.exports = [main, renderer];

fs.ensureDirSync(path.resolve(__dirname, 'dist'));
fs.copySync(path.resolve(__dirname, 'static'), path.resolve(__dirname, 'dist/static'));
fs.copyFileSync(path.resolve(__dirname, 'index.html'), path.resolve(__dirname, 'dist/index.html'));

fs.ensureDirSync(path.resolve(__dirname, 'dist/lib'));
fs.copyFileSync(path.resolve(__dirname, 'example-course-settings.yaml'), path.resolve(__dirname, 'dist/lib/example-course-settings.yaml'));