'use strict';

const path = require('path');
const fs = require('fs-extra');
const { IgnorePlugin } = require('webpack');
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CspHtmlWebpackPlugin = require('csp-html-webpack-plugin');
const distPath = path.resolve(__dirname);

const main = {
  entry: [
    path.resolve(__dirname, './lib/main.js'),
    
  ],
  output: {
    filename: './main.js',
    path: path.resolve(distPath),
  },
  target: 'electron-main',
  node: {
    __dirname: false,
  },
  module: {
    // rules: [
    //   {
    //     test: /\.node$/,
    //     loader: 'node-loader',
    //   },
    // ],
  },
  plugins: [
    new IgnorePlugin(/build\/Debug\/nodegit.node$/i)
  ],
  externals: {
    nodegit: 'commonjs nodegit'
  },
};

const preload = {
    entry: [
      path.resolve(__dirname, './src/preload.js'),
    ],
    node: {
      __dirname: false,
    },
    output: {
      filename: 'preload.js',
      path: path.resolve(distPath),
    },
    target: 'electron-preload'
};

const renderer = {
    entry: path.resolve(__dirname, './lib/render-level.js'),
    output: {
      filename: 'render-level.js',
      path: path.join(distPath),
    },
    node: {
      __dirname: false,
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
          test: /\.vue$/,
          loader: 'vue-loader'
        }
      ]
    },
    plugins: [
      new VueLoaderPlugin(),
      new HtmlWebpackPlugin({
        template: 'src/index_template.html'
      }),
      new CspHtmlWebpackPlugin({
        'script-src': '',
        'style-src': ''
      })
    ],
};


module.exports = (env) => {
  // fs.ensureDirSync(path.resolve(__dirname, 'dist'));
  // fs.copySync(path.resolve(__dirname, 'static'), path.resolve(__dirname, 'dist/static'));
  // fs.copyFileSync(path.resolve(__dirname, 'index.html'), path.resolve(__dirname, 'dist/index.html'));
  // fs.copyFileSync(path.resolve(__dirname, 'example-course-settings.yaml'), path.resolve(__dirname, 'dist/example-course-settings.yaml'));
  
  // fs.ensureDirSync(path.resolve(__dirname, 'dist/example'));
  // fs.copySync(path.resolve(__dirname, 'example/resources'), path.resolve(__dirname, 'dist/example/resources'));
  // fs.copySync(path.resolve(__dirname, 'example/course-resources/fork'), path.resolve(__dirname, 'dist/example/course-resources/fork'))
  
  // fs.ensureDirSync(path.resolve(__dirname, 'dist/example/execution'));
  // fs.copySync(path.resolve(__dirname, 'example/execution/progress'), path.resolve(__dirname, 'dist/example/execution/progress'));

  if (env.pack) {
    console.log('Packing nodegit...');
    // fs.ensureDirSync(path.resolve(__dirname, 'dist/node_modules'));
    // fs.copySync(path.resolve(__dirname, 'node_modules/nodegit'), path.resolve(__dirname, 'dist/node_modules/nodegit'));
  }

  return [main, preload, renderer];
};


