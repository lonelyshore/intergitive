'use strict'

const path = require('path')
const { IgnorePlugin, EnvironmentPlugin } = require('webpack')
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CspHtmlWebpackPlugin = require('csp-html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { DefinePlugin } = require('webpack')
const distPath = path.resolve(__dirname)

module.exports = (env, options) => {
  if (env.pack) {
    console.log('Packing nodegit...')
  }

  const main = {
    entry: [
      path.resolve(__dirname, './src/main/main.js')

    ],
    output: {
      filename: './main.js',
      path: path.resolve(distPath),
      devtoolModuleFilenameTemplate: '[absolute-resource-path]'
    },
    target: 'electron-main',
    node: {
      __dirname: false
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
      new IgnorePlugin(/build\/Debug\/nodegit.node$/i),
      new DefinePlugin({
        'process.env.BUNDLE_VERSION': JSON.stringify(process.env.npm_package_version)
      }),
      new EnvironmentPlugin({
        NODE_ENV: 'dev',
        DEBUG_ENABLED: 'false'
      })
    ],
    externals: {
      nodegit: 'commonjs nodegit'
    }
  }

  const preload = {
    entry: [
      path.resolve(__dirname, './src/main/preload.js')
    ],
    node: {
      __dirname: false
    },
    output: {
      filename: 'preload.js',
      path: path.resolve(distPath)
    },
    target: 'electron-preload'
  }

  if (process.env.DEBUG_ENABLED === 'true') console.log('Chrome developer mode, vue-devtools, and extensive logging are enabled')

  const rendererPlugins = [
    new MiniCssExtractPlugin(),
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: 'src/index_template.html',
      templateParameters: {
        debug: process.env.DEBUG_ENABLED === 'true'
      }
    })
  ]

  if (options.mode === 'production') {
    rendererPlugins.push(
      new CspHtmlWebpackPlugin({
        'script-src': '',
        'style-src': ''
      })
    )
  }

  const renderer = {
    entry: path.resolve(__dirname, './src/renderer/render-level.js'),
    output: {
      filename: 'render-level.js',
      path: path.join(distPath)
    },
    node: {
      __dirname: false
    },
    target: 'electron-renderer',
    resolve: {
      alias: {
        vue$: 'vue/dist/vue.runtime.common.js'
      }
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader']
        },
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        }
      ]
    },
    plugins: rendererPlugins
  }

  return [main, preload, renderer]
}
