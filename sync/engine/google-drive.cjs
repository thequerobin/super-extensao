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
      if (
        response.status === 401 ||
        response.status === 403 ||
        (response.status === 400 &&
          url === "https://oauth2.googleapis.com/token")
      )
        fail("SyncGoogleAuthorizationRequired");
      if (response.status === 429) fail("SyncGoogleRateLimited");
      if (!response.ok) fail("SyncGoogleRequestFailed");
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
      if (typeof error.code === "string" && error.code.startsWith("Sync")) throw error;
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
    const headers = { Authorization: "Bearer " + token.access_token };
    const fields = "id,name,size,version,modifiedTime,md5Checksum";
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
    return { exists: true, content, revision: String(after.version) };
  }
}
module.exports = { GoogleDriveReader };
