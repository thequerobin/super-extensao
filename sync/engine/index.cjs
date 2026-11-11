const { GoogleDriveReader } = require("./google-drive.cjs");
const {
  fail,
  parseXbel,
  fromBrowserTree,
  compareTrees,
} = require("./tree.cjs");
async function inspectGoogleDriveProfile({
  profile,
  oauth,
  bookmarks,
  signal,
  fetchImpl,
}) {
  if (profile?.type !== "google-drive") fail("SyncUnsupportedProvider");
  if (!profile.localRoot || profile.localRoot === "tabs")
    fail("SyncBookmarksOnly");
  if (profile.password || profile.passphrase)
    fail("SyncEncryptedFileUnsupported");
  if (profile.syncing) fail("SyncProfileBusy");
  if (signal?.aborted) fail("SyncCancelled");
  async function readLocal() {
    let roots;
    try {
      roots = await bookmarks.getSubTree(String(profile.localRoot));
    } catch {
      fail("SyncLocalFolderMissing");
    }
    if (!roots?.[0]) fail("SyncLocalFolderMissing");
    return fromBrowserTree(roots[0]);
  }
  const local = await readLocal();
  const reader = new GoogleDriveReader({
    oauth,
    refreshToken: profile.refreshToken,
    signal,
    fetchImpl,
  });
  const file = await reader.read(profile.bookmark_file);
  if (signal?.aborted) fail("SyncCancelled");
  const remote = file.exists
    ? parseXbel(file.content)
    : { kind: "folder", title: "", children: [] };
  const after = await readLocal();
  if (signal?.aborted) fail("SyncCancelled");
  if (JSON.stringify(local) !== JSON.stringify(after))
    fail("SyncLocalTreeChanged");
  return {
    ...compareTrees(local, remote),
    remoteExists: file.exists,
    revision: file.revision || null,
  };
}
module.exports = { inspectGoogleDriveProfile };
