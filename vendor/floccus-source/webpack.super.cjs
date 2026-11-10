const path = require('path')
const webpack = require('webpack')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const base = require('./webpack.common')[1]
module.exports = ['background-script', 'options'].map(name => ({
  ...base,
  mode:'production',
  devtool:false,
  entry:{[name]:path.resolve(__dirname,`src/entries/${name}.js`)},
  module: name === 'options' ? {
    ...base.module,
    rules: base.module.rules.map(rule =>
      Array.isArray(rule.use) && rule.use[0] === 'vue-style-loader'
        ? {...rule, use: [MiniCssExtractPlugin.loader, ...rule.use.slice(1)]}
        : rule
    ),
  } : base.module,
  output:{...base.output,path:path.resolve(__dirname,'dist-super/js'),publicPath:'/sync/js/',uniqueName:`superSync_${name.replace('-','_')}`,globalObject:'globalThis'},
  optimization:{splitChunks:false,runtimeChunk:false,minimize:true},
  performance:{hints:false},
  plugins:[...base.plugins,new webpack.DefinePlugin({DEBUG:'false'}),new webpack.optimize.LimitChunkCountPlugin({maxChunks:1}),
    ...(name === 'options' ? [new MiniCssExtractPlugin({filename: '[name].css'})] : [])],
  stats:'errors-warnings'
}))
