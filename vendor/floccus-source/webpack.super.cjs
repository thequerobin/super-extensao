const path = require('path')
const webpack = require('webpack')
const base = require('./webpack.common')[1]
module.exports = ['background-script', 'options'].map(name => ({
  ...base,
  mode:'production',
  devtool:false,
  entry:{[name]:path.resolve(__dirname,`src/entries/${name}.js`)},
  output:{...base.output,path:path.resolve(__dirname,'dist-super/js'),publicPath:'/sync/js/',uniqueName:`superSync_${name.replace('-','_')}`,globalObject:'globalThis'},
  optimization:{splitChunks:false,runtimeChunk:false,minimize:true},
  performance:{hints:false},
  plugins:[...base.plugins,new webpack.DefinePlugin({DEBUG:'false'}),new webpack.optimize.LimitChunkCountPlugin({maxChunks:1})],
  stats:'errors-warnings'
}))
