const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {JSDOM} = require("jsdom");
const {renderDomainList} = require("../ui/domain-list.js");

test("shared domain list bounds large collections and routes removal without rendering HTML", () => {
  const dom = new JSDOM('<ul></ul>');
  try {
    const doc = dom.window.document, list = doc.querySelector('ul'), calls = [];
    const style = doc.createElement('style');
    style.textContent = fs.readFileSync(path.join(__dirname, '../ui-components.css'), 'utf8'); doc.head.append(style);
    const items = [{domain: '<img src=x>', detail: 'Include subdomains'}, ...Array.from({length: 100}, (_, i) => ({domain: `site${i}.example`}))];
    renderDomainList(list, items, {removeLabel: domain => 'Remove ' + domain, onRemove: domain => calls.push(domain)});
    assert.equal(dom.window.getComputedStyle(list).maxHeight, '210px');
    assert.equal(dom.window.getComputedStyle(list).overflowY, 'auto');
    assert.equal(list.querySelector('img'), null);
    assert.equal(list.querySelector('small').textContent, 'Include subdomains');
    list.querySelector('button').click();
    assert.deepEqual(calls, ['<img src=x>']);
    renderDomainList(list, items, {removeLabel: domain => 'Remove ' + domain, disabled: true, onRemove: domain => calls.push(domain)});
    list.querySelector('button').click();
    assert.equal(calls.length, 1);
  } finally {dom.window.close();}
});
