const { fail } = require("./tree.cjs");
const ROOT = "$root";
const copy = (value) => JSON.parse(JSON.stringify(value));
function index(tree) {
  const nodes = {},
    order = { [ROOT]: [] };
  function visit(folder, parent) {
    for (const item of folder.children || []) {
      const id = String(item.id);
      if (!item.id || id === ROOT || nodes[id]) fail("SyncDuplicateIds");
      const { children: ignored, ...data } = item;
      nodes[id] = { ...copy(data), id, parent };
      order[parent].push(id);
      if (item.kind === "folder") {
        order[id] = [];
        visit(item, id);
      }
    }
  }
  visit(tree, ROOT);
  return { nodes, order };
}
function materialize(nodes, order, template = {}) {
  const visiting = new Set(),
    seen = new Set(),
    grouped = {};
  for (const node of Object.values(nodes))
    (grouped[node.parent] ||= []).push(node.id);
  function children(parent, depth) {
    if (depth > 100 || visiting.has(parent)) fail("SyncFolderCycle");
    visiting.add(parent);
    const list = (order[parent] || []).filter(
      (id) => nodes[id]?.parent === parent
    );
    const listed = new Set(list);
    const missing = (grouped[parent] || []).filter((id) => !listed.has(id));
    const result = [...list, ...missing].map((id) => {
      if (seen.has(id)) fail("SyncDuplicateIds");
      seen.add(id);
      const item = copy(nodes[id]);
      delete item.parent;
      if (item.kind === "folder") item.children = children(id, depth + 1);
      return item;
    });
    visiting.delete(parent);
    return result;
  }
  const tree = {
    kind: "folder",
    title: "",
    attributes: template.attributes || {},
    meta: template.meta || [],
    children: children(ROOT, 0),
  };
  if (seen.size !== Object.keys(nodes).length) fail("SyncFolderCycle");
  return tree;
}
function identify(local, remote, previous, hints = {}) {
  const r = index(remote),
    b = previous?.tree ? index(previous.tree) : { nodes: {} };
  const mapping = {},
    used = new Set();
  const allIds = [
    ...Object.keys(r.nodes),
    ...Object.keys(b.nodes),
    ...Object.values(previous?.mapping || {}),
    ...Object.values(hints),
  ];
  let high = Math.max(remote.highestId || 0, previous?.highestId || 0, 0);
  for (const id of allIds) {
    if (!/^-?\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)))
      fail("SyncInvalidIds");
    high = Math.max(high, Number(id));
  }
  const allocate = () => {
    if (!Number.isSafeInteger(++high)) fail("SyncInvalidIds");
    return String(high);
  };
  const candidates = {};
  for (const node of Object.values(r.nodes)) {
    const key = JSON.stringify([node.parent, node.kind, node.title, node.url]);
    (candidates[key] ||= []).push(node.id);
  }
  function convert(folder, parent) {
    return (folder.children || []).map((item) => {
      const localId = String(item.id),
        hint = previous?.mapping?.[localId] ?? hints[localId];
      let id = hint === undefined ? null : String(hint);
      const known = r.nodes[id] || b.nodes[id];
      if (!known || used.has(id)) id = null;
      if (known && id && known.kind !== item.kind) fail("SyncInvalidIds");
      if (!id) {
        const key = JSON.stringify([parent, item.kind, item.title, item.url]);
        id =
          (candidates[key] || []).find((value) => !used.has(value)) ||
          allocate();
      }
      used.add(id);
      mapping[localId] = id;
      const { children: ignored, ...data } = item;
      const result = { ...copy(data), id };
      if (item.kind === "folder") result.children = convert(item, id);
      return result;
    });
  }
  return {
    local: { kind: "folder", title: "", children: convert(local, ROOT) },
    mapping,
    highestId: high,
  };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fields = ["kind", "title", "url", "parent"];
const recordSame = (a, b) =>
  Boolean(a && b) && fields.every((key) => a[key] === b[key]);
function merge(base, local, remote, strategy = "default") {
  if (!["default", "overwrite", "slave"].includes(strategy))
    fail("SyncUnsupportedStrategy");
  const l = index(local),
    r = index(remote),
    b = base ? index(base) : { nodes: {}, order: {} };
  const result = {},
    conflicts = [];
  for (const id of new Set([
    ...Object.keys(b.nodes),
    ...Object.keys(l.nodes),
    ...Object.keys(r.nodes),
  ])) {
    const before = b.nodes[id],
      left = l.nodes[id],
      right = r.nodes[id];
    if (strategy !== "default") {
      const chosen = strategy === "overwrite" ? left : right;
      if (chosen)
        result[id] = { ...copy(right || before || {}), ...copy(chosen) };
      continue;
    }
    if (!before) {
      if (left && right && !recordSame(left, right)) {
        conflicts.push(id);
        continue;
      }
      result[id] = copy(right || left);
      continue;
    }
    if (!left || !right) {
      const survivor = left || right;
      if (survivor && !recordSame(survivor, before)) conflicts.push(id);
      continue;
    }
    const node = copy(right);
    for (const field of fields) {
      if (left[field] === right[field]) node[field] = left[field];
      else if (left[field] === before[field]) node[field] = right[field];
      else if (right[field] === before[field]) node[field] = left[field];
      else conflicts.push(id);
    }
    result[id] = node;
  }
  // A deleted folder cannot silently discard a concurrently added/moved child.
  for (const node of Object.values(result))
    if (node.parent !== ROOT && !result[node.parent]) conflicts.push(node.id);
  if (conflicts.length) fail("SyncConflict");
  const order = {},
    grouped = {};
  for (const node of Object.values(result))
    (grouped[node.parent] ||= []).push(node.id);
  for (const parent of [
    ROOT,
    ...Object.values(result)
      .filter((node) => node.kind === "folder")
      .map((node) => node.id),
  ]) {
    const ids = grouped[parent] || [],
      allowed = new Set(ids);
    const leftIds = new Set(l.order[parent] || []),
      rightIds = new Set(r.order[parent] || []);
    const common = (b.order[parent] || []).filter(
        (id) => leftIds.has(id) && rightIds.has(id) && allowed.has(id)
      ),
      shared = new Set(common);
    const sequence = (source) =>
      (source.order[parent] || []).filter((id) => shared.has(id));
    const original = common,
      left = sequence(l),
      right = sequence(r);
    if (
      strategy === "default" &&
      !same(left, original) &&
      !same(right, original) &&
      !same(left, right)
    )
      fail("SyncOrderConflict");
    const preferred =
      strategy === "slave"
        ? r
        : strategy === "overwrite"
        ? l
        : !same(left, original)
        ? l
        : r;
    const other = preferred === l ? r : l;
    const next = new Map();
    let head = null,
      tail = null;
    function insert(after, id) {
      if (next.has(id)) return;
      if (after === null) {
        next.set(id, head);
        head = id;
        if (tail === null) tail = id;
      } else {
        next.set(id, next.get(after));
        next.set(after, id);
        if (tail === after) tail = id;
      }
    }
    for (const id of preferred.order[parent] || [])
      if (allowed.has(id)) insert(tail, id);
    let previous = null;
    for (const id of other.order[parent] || [])
      if (allowed.has(id)) {
        insert(previous, id);
        previous = id;
      }
    for (const id of ids) insert(tail, id);
    const merged = [];
    for (let id = head; id !== null; id = next.get(id)) merged.push(id);
    order[parent] = merged;
  }
  return materialize(result, order, remote);
}
function changes(before, after) {
  const a = index(before),
    b = index(after);
  let created = 0,
    deleted = 0,
    updated = 0;
  for (const id of Object.keys(a.nodes)) if (!b.nodes[id]) deleted++;
  for (const id of Object.keys(b.nodes))
    if (!a.nodes[id]) created++;
    else if (!recordSame(a.nodes[id], b.nodes[id])) updated++;
  const reordered = Object.keys(b.order).filter(
    (id) =>
      a.order[id] &&
      !same(
        a.order[id].filter((key) => b.nodes[key]),
        b.order[id].filter((key) => a.nodes[key])
      )
  ).length;
  return {
    created,
    deleted,
    updated,
    reordered,
    total: created + deleted + updated + reordered,
  };
}
function guard(before, target, enabled = true) {
  if (!enabled) return;
  const total = Object.keys(index(before).nodes).length,
    removed = changes(before, target).deleted;
  if (removed && (removed === total || removed > Math.max(5, total * 0.2)))
    fail("SyncDeletionGuard");
}
module.exports = {
  ROOT,
  copy,
  same,
  index,
  materialize,
  identify,
  merge,
  changes,
  guard,
};
