/* Cross-platform build entry for the Super Extensão component. */
process.env.NODE_ENV = "production";
process.env.BUILD_TARGET = "chromium";
const webpack = require("webpack");
const config = require("../webpack.config.js");
const compiler = webpack(config);
compiler.run((error, stats) => {
  if (error || stats.hasErrors()) {
    console.error(error || stats.toString({all:false,errors:true}));
    process.exitCode = 1;
  } else console.log(stats.toString({all:false,timings:true}));
  compiler.close(() => {});
});
