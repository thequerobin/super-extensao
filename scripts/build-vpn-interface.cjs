const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const engine = path.join(root, "vendor/proton-source");
const dependency = createRequire(path.join(engine, "package.json"));
const webpack = dependency("webpack");
const config = {
  mode: "production",
  context: engine,
  target: ["web", "es2020"],
  devtool: false,
  entry: {
    interface: path.join(root, "vpn/source/index.js"),
    blocked: path.join(root, "vpn/source/blocked-index.js"),
  },
  output: {
    path: path.join(root, "vpn"),
    filename: "[name].js",
    uniqueName: "superVpnInterface",
  },
  resolve: {
    extensions: [".js", ".ts"],
    modules: ["node_modules", path.join(engine, "node_modules")],
    alias: { "@vpn-engine": path.join(engine, "source/js") },
  },
  resolveLoader: {
    modules: [path.join(engine, "node_modules"), "node_modules"],
  },
  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
            configFile: path.join(root, "vpn/tsconfig.interface.json"),
            compilerOptions: { noEmit: false },
          },
        },
      },
    ],
  },
  optimization: { splitChunks: false, runtimeChunk: false },
  performance: { hints: false },
};
webpack(config, (error, stats) => {
  if (error) {
    console.error(error);
    process.exitCode = 1;
    return;
  }
  console.log(stats.toString({ all: false, errors: true, warnings: true }));
  if (stats.hasErrors()) {
    process.exitCode = 1;
    return;
  }
  fs.copyFileSync(
    path.join(root, "vpn/source/interface.css"),
    path.join(root, "vpn/interface.css"),
  );
  console.log("Interface própria da VPN compilada.");
});
