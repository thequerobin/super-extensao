const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
module.exports = function load(file, globals = {}, mocks = {}, cache = new Map()) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename);
  const exports = {};
  cache.set(filename, exports);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports, Promise, URL, setTimeout, clearTimeout, ...globals, require(id) {
    if (id in mocks) return mocks[id];
    if (!id.startsWith('.')) throw Error('Unexpected ' + id);
    return load(path.resolve(path.dirname(filename), id + '.ts'), globals, mocks, cache);
  }}, {filename});
  return exports;
};
