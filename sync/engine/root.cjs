const { copy, index, ROOT } = require("./model.cjs");
const { fail } = require("./tree.cjs");

// Permanent root folders belong to the browser. Only their contents are writable.
function normalizeRootTitles(tree, local, mapping) {
  if (!tree) return;
  for (const folder of local.children) {
    const node = tree.children.find(item => item.id === String(mapping[folder.id]));
    if (node?.kind === "folder") node.title = folder.title;
  }
}
function protectRoot(target, local) {
  const nodes = index(target).nodes;
  const permanent = new Set(local.children.map(item => item.id));
  const folders = local.children.map(item => {
    const node = nodes[item.id];
    if (node && (node.kind !== "folder" || node.parent !== ROOT))
      fail("SyncRootLayoutChanged");
    const folder = target.children.find(child => child.id === item.id);
    return folder ? { ...folder, title: item.title } : { ...copy(item), children: [] };
  });
  const extra = target.children.filter(item => !permanent.has(item.id));
  if (extra.length) {
    const destination = folders.find(item => item.title === "Other Bookmarks");
    if (!destination) fail("SyncRootLayoutChanged");
    destination.children.push(...extra);
  }
  target.children = folders;
  return target;
}
module.exports = { normalizeRootTitles, protectRoot };
