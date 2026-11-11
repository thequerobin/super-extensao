// Super Extensão: provider-independent bookmark snapshots and comparisons.
const { XMLParser, XMLValidator } = require("fast-xml-parser");
const LIMITS = { bytes: 20 * 1024 * 1024, nodes: 100000, depth: 100 };
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function parseXbel(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > LIMITS.bytes
  )
    fail("SyncFileTooLarge");
  // External/custom entities and DTDs are unnecessary for the supported format.
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) fail("SyncUnsupportedXml");
  if (XMLValidator.validate(text) !== true) fail("SyncInvalidFile");
  let xml;
  try {
    xml = new XMLParser({
      preserveOrder: true,
      ignorePiTags: true,
      ignoreAttributes: false,
      parseTagValue: false,
      trimValues: false,
      processEntities: true,
      maxNestedTags: LIMITS.depth + 2,
    }).parse(text);
  } catch (error) {
    fail(
      /nested|depth/i.test(error.message)
        ? "SyncTreeTooLarge"
        : "SyncInvalidFile"
    );
  }
  const roots = xml.filter(
    (entry) => !Object.keys(entry).every((key) => key.startsWith("?"))
  );
  if (roots.length !== 1 || !Array.isArray(roots[0].xbel))
    fail("SyncInvalidFile");
  let count = 0;
  const ids = new Set();
  const textOf = (nodes) =>
    (nodes || [])
      .map(
        (node) =>
          node["#text"] ?? (node["#cdata"] ? textOf(node["#cdata"]) : "")
      )
      .join("");
  function children(nodes, depth) {
    if (depth > LIMITS.depth) fail("SyncTreeTooLarge");
    const result = [];
    for (const node of nodes) {
      const kind =
        "folder" in node ? "folder" : "bookmark" in node ? "bookmark" : null;
      if (!kind) {
        if (
          Object.keys(node).some(
            (key) => !["title", "desc", "info", "#text", ":@"].includes(key)
          )
        )
          fail("SyncUnsupportedXml");
        continue;
      }
      if (++count > LIMITS.nodes) fail("SyncTreeTooLarge");
      const attrs = node[":@"] || {},
        id = attrs["@_id"];
      if (id !== undefined) {
        if (ids.has(String(id))) fail("SyncDuplicateIds");
        ids.add(String(id));
      }
      const content = node[kind];
      if (
        kind === "bookmark" &&
        content.some((entry) => "bookmark" in entry || "folder" in entry)
      )
        fail("SyncInvalidFile");
      const titles = content.filter((item) => "title" in item);
      if (titles.length > 1) fail("SyncInvalidFile");
      const item = {
        kind,
        title: titles.length ? textOf(titles[0].title) : "",
      };
      if (id !== undefined) item.id = String(id);
      if (kind === "folder") item.children = children(content, depth + 1);
      else {
        if (typeof attrs["@_href"] !== "string") fail("SyncInvalidFile");
        item.url = attrs["@_href"];
      }
      result.push(item);
    }
    return result;
  }
  return { kind: "folder", title: "", children: children(roots[0].xbel, 0) };
}
function fromBrowserTree(root) {
  let count = 0;
  function convert(node, depth) {
    if (depth > LIMITS.depth || ++count > LIMITS.nodes)
      fail("SyncTreeTooLarge");
    if (!node || typeof node.id !== "string" || typeof node.title !== "string")
      fail("SyncInvalidLocalTree");
    return typeof node.url === "string"
      ? { kind: "bookmark", id: node.id, title: node.title, url: node.url }
      : {
          kind: "folder",
          id: node.id,
          title: node.title,
          children: (node.children || []).map((child) =>
            convert(child, depth + 1)
          ),
        };
  }
  const tree = convert(root, 0);
  if (tree.kind !== "folder") fail("SyncInvalidLocalTree");
  return tree;
}
function compareTrees(local, remote) {
  function entries(root) {
    const result = new Map();
    function visit(folder, path) {
      // Paths are arrays, so titles containing '/' cannot collide with nesting.
      for (const item of folder.children) {
        const next = [...path, item.title];
        const key = JSON.stringify([
          item.kind,
          next,
          item.kind === "bookmark" ? item.url : null,
        ]);
        result.set(key, (result.get(key) || 0) + 1);
        if (item.kind === "folder") visit(item, next);
      }
    }
    visit(root, []);
    return result;
  }
  const left = entries(local),
    right = entries(remote);
  let common = 0,
    localOnly = 0,
    remoteOnly = 0;
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const l = left.get(key) || 0,
      r = right.get(key) || 0;
    common += Math.min(l, r);
    localOnly += Math.max(0, l - r);
    remoteOnly += Math.max(0, r - l);
  }
  // This is an inventory, not an executable merge/deletion plan. Identity,
  // ordering and concurrent edits need the future three-way reconciliation.
  return {
    common,
    localOnly,
    remoteOnly,
    localTotal: common + localOnly,
    remoteTotal: common + remoteOnly,
  };
}
module.exports = { LIMITS, fail, parseXbel, fromBrowserTree, compareTrees };
