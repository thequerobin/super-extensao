const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "vendor/floccus-source");
const requireEngine = createRequire(path.join(source, "package.json"));
const webpack = requireEngine("webpack");
const base = requireEngine("./webpack.super.cjs").find(
  (config) => config.entry["background-script"]
);
const config = {
  ...base,
  context: source,
  entry: {
    "background-script": path.join(root, "sync/engine/background-entry.js"),
  },
  output: { ...base.output, path: path.join(root, "sync/js") },
  resolve: {
    ...base.resolve,
    modules: [
      path.join(root, "node_modules"),
      path.join(source, "node_modules"),
    ],
    alias: { "@sync-engine": path.join(source, "src/lib") },
  },
  resolveLoader: { modules: [path.join(source, "node_modules")] },
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
                requireEngine.resolve(name),
                options,
              ]),
            },
          },
        };
      if (String(rule.test) === String(/\.tsx?$/))
        return {
          ...rule,
          use: {
            ...rule.use,
            options: {
              ...rule.use.options,
              configFile: path.join(source, "tsconfig.json"),
            },
          },
        };
      return rule;
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
  if (stats.hasErrors()) process.exitCode = 1;
});
