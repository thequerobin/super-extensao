const { fail } = require("./tree.cjs");
async function key(password, salt) {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations: 250000,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
function base64(bytes) {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    result += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(result);
}
async function decode(content, password, filename) {
  if (!password) return content;
  // An existing plaintext file can be encrypted by the first successful write.
  if (content.trimStart().startsWith("<?xml")) return content;
  try {
    let ciphertext = content,
      salt = filename;
    if (content.trimStart().startsWith("{")) {
      const data = JSON.parse(content);
      ciphertext = data.ciphertext;
      salt = data.salt;
    }
    if (typeof ciphertext !== "string" || typeof salt !== "string")
      fail("SyncDecryptionFailed");
    const bytes = Uint8Array.from(atob(ciphertext), (char) =>
      char.charCodeAt(0)
    );
    if (bytes.length < 33) fail("SyncDecryptionFailed");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 16) },
      await key(password, salt),
      bytes.slice(16)
    );
    return new TextDecoder().decode(plain);
  } catch {
    fail("SyncDecryptionFailed");
  }
}
async function encode(content, password) {
  if (!password) return content;
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(64)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await key(password, salt),
      new TextEncoder().encode(content)
    )
  );
  const bytes = new Uint8Array(iv.length + cipher.length);
  bytes.set(iv);
  bytes.set(cipher, iv.length);
  return JSON.stringify({ salt, ciphertext: base64(bytes) });
}
async function fingerprint(data) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(data))
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
module.exports = { encode, decode, fingerprint };
