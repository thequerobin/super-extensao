// Native DOM adapter. Strings are text nodes, never HTML.
function createUi(document, catalog, name, options = {}, children = []) {
  const spec = catalog[name];
  if (!spec) throw new Error(`Unknown UI component: ${name}`);
  const tag = options.as || spec.tag;
  if (!(spec.tags || [spec.tag]).includes(tag)) throw new Error(`Invalid tag for ${name}: ${tag}`);
  const element = document.createElement(tag);
  element.className = [spec.class, options.className].filter(Boolean).join(' ');
  for (const [key, value] of Object.entries({ ...spec.attrs, ...options.attrs })) {
    if (key === 'type' && tag !== 'button') continue;
    if (value === false || value == null) continue;
    element.setAttribute(key, value === true ? '' : String(value));
  }
  for (const [event, listener] of Object.entries(options.on || {})) element.addEventListener(event, listener);
  for (const child of [].concat(children)) if (child != null) element.append(child.nodeType ? child : document.createTextNode(String(child)));
  return element;
}
module.exports = { createUi };
