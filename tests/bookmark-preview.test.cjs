const {test} = require("node:test");
const assert = require("node:assert/strict");
const {JSDOM} = require("jsdom");
const {renderBookmarkPreview} = require("../ui/bookmark-preview.js");

test("shared bookmark preview lists existing domains even when nothing can be imported", () => {
  const dom = new JSDOM('<div class="ui-card"></div>');
  try {
    const card = dom.window.document.querySelector('div');
    renderBookmarkPreview(card, {domains: ["a.example", "b.example"], fresh: [], skipped: 1}, "pt-BR");
    assert.equal(card.querySelector('strong').textContent, "0 novos domínios");
    assert.equal(card.querySelector('p').textContent, "2 únicos nesta pasta · 2 já na lista · 1 links incompatíveis ignorados");
    assert.deepEqual([...card.querySelectorAll('li')].map(item => item.textContent), ["a.example (já na lista)", "b.example (já na lista)"]);
    renderBookmarkPreview(card, {domains: [], fresh: [], skipped: 0}, "en");
    assert.equal(card.querySelectorAll('li').length, 0);
    assert.equal(card.querySelector('strong').textContent, "0 new domains");
  } finally {dom.window.close();}
});

test("shared bookmark preview translates and renders untrusted labels as text", () => {
  const dom = new JSDOM('<div></div>');
  try {
    const card = dom.window.document.querySelector('div');
    renderBookmarkPreview(card, {domains: ['<img src=x onerror=alert(1)>', 'known.example'], fresh: ['<img src=x onerror=alert(1)>'], skipped: 0}, "en", {count: "count", detail: "detail", domains: "list"});
    assert.equal(card.querySelector('#count').textContent, "1 new domain");
    assert.equal(card.querySelector('img'), null);
    assert.equal(card.querySelectorAll('#list li')[1].textContent, "known.example (already listed)");
    assert.equal(card.getAttribute('role'), 'status');
  } finally {dom.window.close();}
});
