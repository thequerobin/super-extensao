const catalog = require('./catalog.json');

// Build-time/native adapter. No custom elements, observer or runtime registry.
// Content and attributes must already be escaped by the caller. Never pass user HTML.
function renderUi(template) {
  const stack = [];
  const result = template.replace(/<(\/?)ui-([a-z]+)\b([^>]*?)>/g, (match, closing, name, source) => {
    const spec = catalog[name];
    if (!spec) throw new Error(`Unknown UI component: ${name}`);
    if (closing) {
      const opened = stack.pop();
      if (!opened || opened.name !== name) throw new Error(`Unbalanced UI component: ${name}`);
      return `</${opened.tag}>`;
    }
    let tag = spec.tag;
    let attributes = source.replace(/\s+as="([a-z0-9]+)"/g, (_, value) => {
      if (!(spec.tags || [spec.tag]).includes(value)) throw new Error(`Invalid tag for ${name}: ${value}`);
      tag = value;
      return '';
    });
    const selfClosing = /\/\s*$/.test(attributes);
    attributes = attributes.replace(/\/\s*$/, '');
    let hasClass = false;
    attributes = attributes.replace(/\bclass="([^"]*)"/, (_, value) => {
      hasClass = true;
      return `class="${spec.class} ${value}"`;
    });
    if (!hasClass) attributes += ` class="${spec.class}"`;
    for (const [key, value] of Object.entries(spec.attrs || {})) {
      if (key === 'type' && tag !== 'button') continue;
      if (!new RegExp(`(?:^|\\s)${key}\\s*=`).test(attributes)) attributes += ` ${key}="${value}"`;
    }
    const isVoid = ['input', 'hr', 'img', 'br'].includes(tag);
    if (!isVoid && !selfClosing) stack.push({ name, tag });
    return `<${tag}${attributes}>${selfClosing && !isVoid ? `</${tag}>` : ''}`;
  });
  if (stack.length) throw new Error(`Unclosed UI component: ${stack.at(-1).name}`);
  return result;
}

module.exports = { catalog, renderUi };
