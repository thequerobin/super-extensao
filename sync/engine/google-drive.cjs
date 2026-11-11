// Independent, read-only Google Drive connector. Credentials stay in memory.
const { LIMITS, fail } = require("./tree.cjs");
const API = "https://www.googleapis.com/drive/v3/files";
class GoogleDriveReader {
  constructor({
    oauth,
    refreshToken,
    fetchImpl = globalThis.fetch,
    signal,
    timeout = 30000,
  }) {
    if (!oauth?.googleClientId || !refreshToken)
      fail("SyncGoogleAuthorizationRequired");
    this.oauth = oauth;
    this.refreshToken = refreshToken;
    this.fetch = fetchImpl;
    this.signal = signal;
    this.timeout = timeout;
  }
  async request(url, options = {}) {
    const abort = new AbortController();
    const cancel = () => abort.abort();
    if (this.signal?.aborted) fail("SyncCancelled");
    this.signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, this.timeout);
    try {
      const response = await this.fetch(url, {
        ...options,
        signal: abort.signal,
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
      });
      const httpError = (code) => {
        const error = new Error(code);
        error.code = code;
        error.status = response.status;
        throw error;
      };
      if (
        response.status === 401 ||
        response.status === 403 ||
        (response.status === 400 &&
          url === "https://oauth2.googleapis.com/token")
      )
        httpError("SyncGoogleAuthorizationRequired");
      if (response.status === 429) httpError("SyncGoogleRateLimited");
      if (response.status === 412) httpError("SyncRemoteFileChanged");
      if (response.status === 409) httpError("SyncCreateConflict");
      if (!response.ok) httpError("SyncGoogleRequestFailed");
      // Read the body within the timeout and enforce limits before XML parsing.
      const declared = Number(response.headers.get("content-length"));
      if (declared > LIMITS.bytes) fail("SyncFileTooLarge");
      const stream = response.body?.getReader();
      if (!stream) {
        const text = await response.text();
        if (new TextEncoder().encode(text).length > LIMITS.bytes)
          fail("SyncFileTooLarge");
        return text;
      }
      const decoder = new TextDecoder(),
        parts = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await stream.read();
          if (done) break;
          size += value.byteLength;
          if (size > LIMITS.bytes) {
            await stream.cancel();
            fail("SyncFileTooLarge");
          }
          parts.push(decoder.decode(value, { stream: true }));
        }
        parts.push(decoder.decode());
        return parts.join("");
      } finally {
        stream.releaseLock();
      }
    } catch (error) {
      if (this.signal?.aborted) fail("SyncCancelled");
      if (abort.signal.aborted) fail("SyncRequestTimedOut");
      if (typeof error.code === "string" && error.code.startsWith("Sync"))
        throw error;
      fail("SyncGoogleRequestFailed");
    } finally {
      clearTimeout(timer);
      this.signal?.removeEventListener("abort", cancel);
    }
  }
  async json(url, options) {
    try {
      return JSON.parse(await this.request(url, options));
    } catch (error) {
      if (error.code) throw error;
      fail("SyncInvalidResponse");
    }
  }
  async read(name) {
    if (typeof name !== "string" || !name.trim() || name.includes("/"))
      fail("SyncInvalidFileName");
    if (!this.headers) {
      const body = new URLSearchParams({
        client_id: this.oauth.googleClientId,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      });
      if (this.oauth.googleClientSecret)
        body.set("client_secret", this.oauth.googleClientSecret);
      const token = await this.json("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (typeof token.access_token !== "string" || !token.access_token)
        fail("SyncGoogleAuthorizationRequired");
      this.headers = { Authorization: "Bearer " + token.access_token };
    }
    const headers = this.headers;
    const fields =
      "id,name,size,version,modifiedTime,md5Checksum,appProperties";
    const query =
      "trashed = false and mimeType != 'application/vnd.google-apps.folder' and name = '" +
      name.replace(/[\\']/g, "\\$&") +
      "'";
    const files = [];
    let pageToken;
    for (let page = 0; page < 10; page++) {
      const params = new URLSearchParams({
        q: query,
        pageSize: "100",
        fields: "nextPageToken,files(" + fields + ")",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const list = await this.json(API + "?" + params, { headers });
      if (!Array.isArray(list.files)) fail("SyncInvalidResponse");
      files.push(...list.files);
      if (files.length > 1) fail("SyncAmbiguousDriveFile");
      pageToken = list.nextPageToken;
      if (!pageToken) break;
    }
    if (pageToken) fail("SyncGoogleRequestFailed");
    if (!files.length) return { exists: false, content: null };
    const file = files[0];
    if (
      typeof file.id !== "string" ||
      !file.id ||
      !file.version ||
      !/^\d+$/.test(String(file.size))
    )
      fail("SyncInvalidResponse");
    if (Number(file.size) > LIMITS.bytes) fail("SyncFileTooLarge");
    const url = API + "/" + encodeURIComponent(file.id);
    const content = await this.request(url + "?alt=media", { headers });
    if (new TextEncoder().encode(content).length !== Number(file.size))
      fail("SyncRemoteFileChanged");
    const after = await this.json(url + "?fields=" + fields, { headers });
    if (
      String(after.version) !== String(file.version) ||
      String(after.size) !== String(file.size) ||
      after.md5Checksum !== file.md5Checksum
    )
      fail("SyncRemoteFileChanged");
    return {
      exists: true,
      content,
      revision: String(after.version),
      id: file.id,
      size: file.size,
      md5Checksum: file.md5Checksum,
      appProperties: after.appProperties || file.appProperties || {},
    };
  }
}
module.exports = { GoogleDriveReader };

// Writes require the Drive v2 resource ETag. Never downgrade to an
// unconditional upload if a precondition is absent or rejected.
class GoogleDriveClient extends GoogleDriveReader {
  async write(file, content, name, createId) {
    const headers = this.headers;
    if (!headers) fail("SyncGoogleAuthorizationRequired");
    if (file.exists) {
      const meta = await this.json(
        "https://www.googleapis.com/drive/v2/files/" +
          encodeURIComponent(file.id) +
          "?fields=id,etag,fileSize,md5Checksum",
        { headers }
      );
      if (
        !meta.etag ||
        !meta.md5Checksum ||
        meta.md5Checksum !== file.md5Checksum ||
        String(meta.fileSize) !== String(file.size)
      )
        fail("SyncWritePrecondition");
      await this.request(
        "https://www.googleapis.com/upload/drive/v2/files/" +
          encodeURIComponent(file.id) +
          "?uploadType=media",
        {
          method: "PUT",
          headers: {
            ...headers,
            "Content-Type": "application/octet-stream",
            "If-Match": meta.etag,
          },
          body: content,
        }
      );
    } else {
      if (!createId) fail("SyncWritePrecondition");
      const boundary = "super_sync_" + createId.replace(/[^a-zA-Z0-9]/g, "");
      const body =
        "--" +
        boundary +
        "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify({
          id: createId,
          name,
          mimeType: "application/octet-stream",
        }) +
        "\r\n--" +
        boundary +
        "\r\nContent-Type: application/octet-stream\r\n\r\n" +
        content +
        "\r\n--" +
        boundary +
        "--";
      await this.request(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "multipart/related; boundary=" + boundary,
          },
          body,
        }
      );
    }
    const after = await this.read(name);
    if (
      !after.exists ||
      after.id !== (file.id || createId) ||
      after.content !== content
    )
      fail("SyncRemoteFileChanged");
    return after;
  }
  async generateId() {
    const data = await this.json(
      "https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive",
      { headers: this.headers }
    );
    if (!Array.isArray(data.ids) || typeof data.ids[0] !== "string")
      fail("SyncInvalidResponse");
    return data.ids[0];
  }
}
module.exports.GoogleDriveClient = GoogleDriveClient;
GoogleDriveClient.prototype.acquireLease = async function (file, owner) {
  const url =
    "https://www.googleapis.com/drive/v2/files/" + encodeURIComponent(file.id);
  const meta = await this.json(url + "?fields=id,etag,properties", {
    headers: this.headers,
  });
  const properties = meta.properties || [];
  const value = (key) =>
    properties.find(
      (item) => item.key === key && (item.visibility || "PRIVATE") === "PRIVATE"
    )?.value;
  const lock = value("locked");
  if (lock && lock !== "false" && value("superSyncOwner") !== owner) {
    let time;
    try {
      time = JSON.parse(lock);
    } catch {
      time = null;
    }
    if (!Number.isFinite(time) || Date.now() - time < 15 * 60 * 1000)
      fail("SyncRemoteLocked");
  }
  if (!meta.etag) fail("SyncWritePrecondition");
  const next = properties
    .filter(
      (item) =>
        !(
          (item.visibility || "PRIVATE") === "PRIVATE" &&
          ["locked", "superSyncOwner"].includes(item.key)
        )
    )
    .map(({ key, value, visibility = "PRIVATE" }) => ({
      key,
      value,
      visibility,
    }));
  next.push(
    { key: "locked", value: String(Date.now()), visibility: "PRIVATE" },
    { key: "superSyncOwner", value: owner, visibility: "PRIVATE" }
  );
  await this.request(url, {
    method: "PATCH",
    headers: {
      ...this.headers,
      "Content-Type": "application/json",
      "If-Match": meta.etag,
    },
    body: JSON.stringify({ properties: next }),
  });
  this.lease = { id: file.id, owner, renewedAt: Date.now() };
};
GoogleDriveClient.prototype.renewLease = async function () {
  if (this.lease && Date.now() - this.lease.renewedAt > 60000)
    await this.acquireLease({ id: this.lease.id }, this.lease.owner);
};
GoogleDriveClient.prototype.releaseLease = async function () {
  if (!this.lease) return;
  const lease = this.lease;
  // Cleanup must remain possible after cancellation of the sync request.
  const cleanup = new GoogleDriveClient({
    oauth: this.oauth,
    refreshToken: this.refreshToken,
    fetchImpl: this.fetch,
    timeout: 10000,
  });
  cleanup.headers = this.headers;
  try {
    const url =
      "https://www.googleapis.com/drive/v2/files/" +
      encodeURIComponent(lease.id);
    const meta = await cleanup.json(url + "?fields=id,etag,properties", {
      headers: cleanup.headers,
    });
    if (
      !meta.etag ||
      !(meta.properties || []).some(
        (item) =>
          item.key === "superSyncOwner" &&
          item.value === lease.owner &&
          (item.visibility || "PRIVATE") === "PRIVATE"
      )
    )
      return;
    const properties = meta.properties.map(
      ({ key, value, visibility = "PRIVATE" }) => ({
        key,
        value: visibility === "PRIVATE" && key === "locked" ? "false" : value,
        visibility,
      })
    );
    await cleanup.request(url, {
      method: "PATCH",
      headers: {
        ...cleanup.headers,
        "Content-Type": "application/json",
        "If-Match": meta.etag,
      },
      body: JSON.stringify({ properties }),
    });
  } finally {
    this.lease = null;
  }
};
