'use strict';

const path = require('path');
const fs = require('fs-extra');
const { IgnorePlugin } = require('webpack');
const VueLoaderPlugin = require('vue-loader/lib/plugin')
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
  base,
  {
    entry: path.resolve(__dirname, './lib/render-level.js'),
    output: {
      filename: 'render-level.js',
      path: path.join(distPath, 'lib'),
    },
    target: 'electron-renderer',
    resolve: {
      alias: {
        "vue$" : "vue/dist/vue.runtime.common.js"
      }
    },
    module: {
      rules: [
        {
          test: /\.node$/,
          loader: 'node-loader',
        },
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        }
      ]
    },
    plugins: [
      new IgnorePlugin(/build\/Debug\/nodegit.node$/i),
      new VueLoaderPlugin()
    ],
  }
);


module.exports = [main, renderer];

fs.ensureDirSync(path.resolve(__dirname, 'dist'));
fs.copySync(path.resolve(__dirname, 'static'), path.resolve(__dirname, 'dist/static'));
fs.copyFileSync(path.resolve(__dirname, 'index.html'), path.resolve(__dirname, 'dist/index.html'));

//fs.ensureDirSync(path.resolve(__dirname, 'dist'));
fs.copyFileSync(path.resolve(__dirname, 'example-course-settings.yaml'), path.resolve(__dirname, 'dist/example-course-settings.yaml'));

fs.ensureDirSync(path.resolve(__dirname, 'dist/example'));
fs.copySync(path.resolve(__dirname, 'example/resources'), path.resolve(__dirname, 'dist/example/resources'));
fs.copySync(path.resolve(__dirname, 'example/course-resources/fork'), path.resolve(__dirname, 'dist/example/course-resources/fork'))
