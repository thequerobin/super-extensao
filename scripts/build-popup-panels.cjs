const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const requireBuildDependency = createRequire(path.join(root, 'vendor/proton-source/package.json'));
const postcss = requireBuildDependency('postcss');
const selectors = requireBuildDependency('postcss-selector-parser');
const cssnano = requireBuildDependency('cssnano');

function scopedCss(file, panel) {
  const css = postcss.parse(fs.readFileSync(path.join(root, file), 'utf8'), { from: file });
  css.walkAtRules('import', rule => {
    if (rule.params.includes('ui-theme.css')) rule.remove();
  });
  css.walkRules(rule => {
    if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    rule.selector = selectors(list => {
      list.each(selector => {
        const first = selector.first;
        const scope = selectors.id({ value: panel });
        if ((first.type === 'tag' && ['body', 'html'].includes(first.value)) ||
            (first.type === 'pseudo' && first.value === ':root')) {
          first.replaceWith(scope);
        } else {
          selector.prepend(selectors.combinator({ value: ' ' }));
          selector.prepend(scope);
        }
      });
    }).processSync(rule.selector);
  });
  // Keep references relative to the original stylesheet after moving them to the popup.
  css.walkDecls(declaration => {
    declaration.value = declaration.value.replace(/url\((['"]?)([^)'"]+)\1\)/g, (match, quote, resource) => {
      if (/^(?:[a-z]+:|[/#])/i.test(resource)) return match;
      return `url(${quote}/${path.posix.normalize(path.posix.join(path.posix.dirname(file), resource))}${quote})`;
    });
  });
  return css.toString();
}

const sheets = [
  ['sync/js/options.css', 'syncPanel'], ['ui-components.css', 'syncPanel'],
  ['sync/theme.css', 'syncPanel'],
  ['vpn/source/interface.css', 'vpnPanel']
];
const css = sheets.map(([file, panel]) => scopedCss(file, panel)).join('\n');
postcss([cssnano()]).process(css, { from: undefined }).then(result => {
  fs.writeFileSync(path.join(root, 'popup-panels.css'), result.css + '\n');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
