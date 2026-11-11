const { fromBrowserTree, fail } = require("./tree.cjs");
const { copy, same, index, ROOT } = require("./model.cjs");
async function read(bookmarks, root) {
  let data;
  try {
    data = await bookmarks.getSubTree(String(root));
  } catch {
    fail("SyncLocalFolderMissing");
  }
  if (!data?.[0]) fail("SyncLocalFolderMissing");
  return fromBrowserTree(data[0]);
}
function find(tree, id) {
  if (String(tree.id) === String(id)) return tree;
  for (const child of tree.children || []) {
    const item = find(child, id);
    if (item) return item;
  }
}
function parent(tree, id) {
  if ((tree.children || []).some((child) => child.id === id)) return tree;
  for (const child of tree.children || []) {
    const result = parent(child, id);
    if (result) return result;
  }
}
function simulate(before, op, createdId) {
  const tree = copy(before);
  if (op.type === "create") {
    const item = {
      kind: op.item.kind,
      id: String(createdId),
      title: op.item.title,
    };
    if (item.kind === "folder") item.children = [];
    else item.url = op.item.url;
    find(tree, op.parentId).children.splice(op.index, 0, item);
  } else if (op.type === "update") Object.assign(find(tree, op.id), op.details);
  else if (op.type === "move") {
    const old = parent(tree, op.id),
      item = find(tree, op.id);
    old.children.splice(
      old.children.findIndex((child) => child.id === op.id),
      1
    );
    find(tree, op.parentId).children.splice(op.index, 0, item);
  } else if (op.type === "remove") {
    const old = parent(tree, op.id);
    old.children.splice(
      old.children.findIndex((child) => child.id === op.id),
      1
    );
  }
  return tree;
}
function nextOperation(journal, current) {
  const target = index(journal.target),
    inverse = Object.fromEntries(
      Object.entries(journal.mapping).map(([local, remote]) => [remote, local])
    );
  inverse[ROOT] = current.id;
  const queue = (folder) => {
    for (const item of folder.children || []) {
      const localId = inverse[item.id],
        desiredParent = inverse[target.nodes[item.id].parent];
      if (!desiredParent) fail("SyncInvalidIds");
      const node = localId && find(current, localId);
      if (!node)
        return {
          type: "create",
          canonical: item.id,
          parentId: desiredParent,
          index: find(current, desiredParent).children.length,
          item: {
            kind: item.kind,
            title: item.title,
            ...(item.kind === "bookmark" ? { url: item.url } : {}),
          },
        };
      if (node.kind !== item.kind) fail("SyncInvalidIds");
      const oldParent = parent(current, localId);
      if (oldParent.id !== desiredParent)
        return { type: "move", id: localId, parentId: desiredParent, index: 0 };
      const details = {};
      if (node.title !== item.title) details.title = item.title;
      if (node.kind === "bookmark" && node.url !== item.url)
        details.url = item.url;
      if (Object.keys(details).length)
        return { type: "update", id: localId, details };
      if (item.kind === "folder") {
        const op = queue(item);
        if (op) return op;
      }
    }
  };
  const update = queue(journal.target);
  if (update) return update;
  // Retained descendants have already moved out. Delete leaves, never removeTree.
  function extras(folder) {
    for (const item of folder.children || []) {
      if (item.kind === "folder") {
        const op = extras(item);
        if (op) return op;
      }
      if (!target.nodes[journal.mapping[item.id]])
        return { type: "remove", id: item.id };
    }
  }
  const removal = extras(current);
  if (removal) return removal;
  for (const [folder, ids] of Object.entries(target.order)) {
    const actual = find(current, inverse[folder]);
    for (let position = 0; position < ids.length; position++) {
      const localId = inverse[ids[position]];
      if (actual.children[position]?.id !== localId)
        return {
          type: "move",
          id: localId,
          parentId: actual.id,
          index: position,
        };
    }
  }
}
async function apply({
  bookmarks,
  journal,
  save,
  signal,
  validate = async () => {},
}) {
  const check = () => {
    if (signal?.aborted) fail("SyncCancelled");
  };
  while (true) {
    check();
    const current = await read(bookmarks, journal.root);
    if (journal.pending) {
      const op = journal.pending;
      if (op.type === "create" && !op.result) {
        const beforeIds = new Set(
          (find(journal.expectedLocal, op.parentId)?.children || []).map(
            (node) => node.id
          )
        );
        const candidates = (find(current, op.parentId)?.children || []).filter(
          (node) =>
            !beforeIds.has(node.id) &&
            node.kind === op.item.kind &&
            node.title === op.item.title &&
            node.url === op.item.url
        );
        if (candidates.length === 1) op.result = candidates[0].id;
        else if (candidates.length > 1) fail("SyncRecoveryConflict");
      }
      if (op.type !== "create" || op.result) {
        const after = simulate(journal.expectedLocal, op, op.result);
        if (same(current, after)) {
          if (op.type === "create")
            journal.mapping[String(op.result)] = op.canonical;
          if (op.type === "remove") delete journal.mapping[op.id];
          journal.expectedLocal = current;
          journal.pending = null;
          await save(journal);
          continue;
        }
      }
      if (!same(current, journal.expectedLocal)) fail("SyncRecoveryConflict");
      // The API call never committed; retry the already-persisted operation.
    } else {
      if (!same(current, journal.expectedLocal)) fail("SyncLocalTreeChanged");
      const op = nextOperation(journal, current);
      if (!op) return journal.mapping;
      journal.pending = op;
      await save(journal);
    }
    check();
    await validate();
    try {
      const op = journal.pending;
      if (op.type === "create") {
        const created = await bookmarks.create({
          parentId: op.parentId,
          index: op.index,
          title: op.item.title,
          ...(op.item.kind === "bookmark" ? { url: op.item.url } : {}),
        });
        op.result = String(created.id);
        await save(journal);
      } else if (op.type === "update")
        await bookmarks.update(op.id, op.details);
      else if (op.type === "move")
        await bookmarks.move(op.id, { parentId: op.parentId, index: op.index });
      else await bookmarks.remove(op.id);
    } catch (error) {
      if (typeof error.code === "string" && error.code.startsWith("Sync"))
        throw error;
      fail("SyncLocalWriteFailed");
    }
    // The next iteration verifies the exact resulting tree before checkpointing.
  }
}
module.exports = { read, find, simulate, nextOperation, apply };
