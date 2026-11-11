const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const engine = path.join(root, "vendor/floccus-source");
const engineRequire = createRequire(path.join(engine, "package.json"));
const webpack = engineRequire("webpack");
const base = engineRequire("./webpack.super.cjs").find(
  (config) => config.entry.options
);
// Build only our interface. The existing background bundle/engine is unchanged.
const config = {
  ...base,
  context: engine,
  entry: { options: path.join(root, "sync/source/index.js") },
  output: { ...base.output, path: path.join(root, "sync/js") },
  resolve: {
    ...base.resolve,
    modules: ["node_modules", path.join(engine, "node_modules")],
    alias: { "@sync-engine": path.join(engine, "src/lib") },
  },
  resolveLoader: {
    modules: ["node_modules", path.join(engine, "node_modules")],
  },
  module: {
    ...base.module,
    rules: base.module.rules.map((rule) => {
      if (String(rule.test) === String(/\.js$/))
        return {
          ...rule,
          use: {
            ...rule.use,
            options: {
              ...rule.use.options,
              presets: rule.use.options.presets.map(([name, options]) => [
                engineRequire.resolve(name),
                options,
              ]),
            },
          },
        };
      if (String(rule.test) !== String(/\.tsx?$/)) return rule;
      return {
        ...rule,
        use: {
          ...rule.use,
          options: {
            ...rule.use.options,
            configFile: path.join(engine, "tsconfig.json"),
          },
        },
      };
    }),
  },
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
    path.join(root, "sync/source/interface.css"),
    path.join(root, "sync/theme.css")
  );
  console.log("Interface de sincronização compilada.");
});
