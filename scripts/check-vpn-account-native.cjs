// Isolated native account test: compiled worker, synthetic data, no personal profile or account.
// Set CHROMIUM_PATH to override the local Chromium/Edge executable.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "super-account-native-")),
  extension = path.join(temp, "extension"),
  profile = path.join(temp, "profile");
fs.mkdirSync(extension);
fs.mkdirSync(profile);
fs.mkdirSync(path.join(extension, "vpn"));
fs.cpSync(path.join(root, "vpn/js"), path.join(extension, "vpn/js"), {
  recursive: true,
});
fs.writeFileSync(
  path.join(extension, "page.html"),
  "<!doctype html><title>Isolated account test</title>",
);
fs.writeFileSync(
  path.join(extension, "manifest.json"),
  JSON.stringify({
    manifest_version: 3,
    name: "Isolated account core test",
    version: "1.0",
    permissions: [
      "storage",
      "alarms",
      "notifications",
      "tabs",
      "idle",
      "privacy",
      "proxy",
      "webRequest",
      "webRequestAuthProvider",
      "declarativeNetRequest",
      "scripting",
    ],
    host_permissions: ["<all_urls>"],
    background: { service_worker: "worker.js" },
  }),
);
fs.writeFileSync(
  path.join(extension, "worker.js"),
  `globalThis.accountRequests=0;globalThis.fetch=async input=>{const url=String(input);if(url.includes('/api/vpn/v2')){accountRequests++;return new Response(JSON.stringify({Code:1000,User:{VPN:{Name:'Fixture',MaxTier:2,PlanName:'fixture',Groups:[]}}}),{headers:{'content-type':'application/json'}});}if(url.includes('/api/core/v4/users'))return new Response(JSON.stringify({User:{ID:'fixture',Name:'Fixture'}}),{headers:{'content-type':'application/json'}});return new Response('{}',{headers:{'content-type':'application/json'}});};importScripts('/vpn/js/browser-polyfill.min.js','/vpn/js/background.js');`,
);
const proc = spawn(
  process.env.CHROMIUM_PATH ||
    (process.platform === "win32"
      ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
      : "/usr/bin/chromium"),
  [
    "--headless=new",
    "--remote-debugging-port=0",
    "--user-data-dir=" + profile,
    "--no-first-run",
    "--disable-background-networking",
    "--disable-component-update",
    "--host-resolver-rules=MAP * ~NOTFOUND",
    "--disable-extensions-except=" + extension,
    "--load-extension=" + extension,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
proc.on("error", (error) => {
  console.error("Browser launch failed: " + error.message);
});
const sockets = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect(url) {
  const socket = new WebSocket(url);
  sockets.push(socket);
  await new Promise((r, j) => {
    socket.addEventListener("open", r, { once: true });
    socket.addEventListener("error", j, { once: true });
  });
  let next = 0;
  const pending = new Map();
  socket.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { r, j, t } = pending.get(msg.id);
      clearTimeout(t);
      pending.delete(msg.id);
      msg.error ? j(Error(msg.error.message)) : r(msg.result);
    }
  });
  return (method, params = {}) =>
    new Promise((r, j) => {
      const id = ++next,
        t = setTimeout(() => {
          pending.delete(id);
          j(Error("CDP timed out: " + method));
        }, 12000);
      pending.set(id, { r, j, t });
      socket.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(call, expression) {
  const result = await call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text,
    );
  return result.result.value;
}
(async () => {
  let port;
  for (let i = 0; i < 150; i++) {
    try {
      port = fs
        .readFileSync(path.join(profile, "DevToolsActivePort"), "utf8")
        .split("\n")[0];
      break;
    } catch {}
    await pause(100);
  }
  assert.ok(port, "Edge DevTools did not start");
  let worker;
  for (let i = 0; i < 100; i++) {
    const targets = await (
      await fetch("http://127.0.0.1:" + port + "/json/list")
    ).json();
    worker = targets.find(
      (t) => t.type === "service_worker" && t.url.endsWith("/worker.js"),
    );
    if (worker) break;
    await pause(100);
  }
  assert.ok(worker, "compiled worker did not initialize");
  const workerCall = await connect(worker.webSocketDebuggerUrl);
  let workerReady = false;
  for (let i = 0; i < 100; i++) {
    workerReady = await evaluate(
      workerCall,
      "typeof chrome !== 'undefined' && !!chrome.runtime?.id && typeof getVpnDiagnostics === 'function'",
    );
    if (workerReady) break;
    await pause(100);
  }
  assert.ok(workerReady, "compiled extension worker did not finish loading");
  await evaluate(
    workerCall,
    `chrome.storage.local.set({'superVpn:session':{uid:'fixture',accessToken:'synthetic-token',refreshToken:'synthetic-refresh'},'superVpn:user':{time:Date.now(),user:{VPN:{MaxTier:0,Name:'Legacy cache',PlanName:'free'}}}})`,
  );
  const browserInfo = await (
      await fetch("http://127.0.0.1:" + port + "/json/version")
    ).json(),
    browserCall = await connect(browserInfo.webSocketDebuggerUrl);
  const id = new URL(worker.url).hostname;
  const target = await browserCall("Target.createTarget", {
    url: "chrome-extension://" + id + "/page.html",
  });
  let page;
  for (let i = 0; i < 50; i++) {
    const targets = await (
      await fetch("http://127.0.0.1:" + port + "/json/list")
    ).json();
    page = targets.find((t) => t.id === target.targetId);
    if (page) break;
    await pause(100);
  }
  assert.ok(page);
  const pageCall = await connect(page.webSocketDebuggerUrl);
  let ready = false;
  for (let i = 0; i < 50; i++) {
    ready = await evaluate(
      pageCall,
      "typeof chrome !== 'undefined' && !!chrome.runtime?.id",
    );
    if (ready) break;
    await pause(100);
  }
  assert.ok(ready, "extension page did not finish loading");
  const send = (type) =>
    evaluate(
      pageCall,
      `chrome.runtime.sendMessage({channel:'super-vpn',respondTo:'test',type:'${type}'})`,
    );
  const legacy = await send("user");
  assert.equal(legacy.success, true);
  assert.equal(legacy.result.VPN.Name, "Legacy cache");
  await evaluate(
    workerCall,
    `chrome.storage.local.set({'superVpn:user':{time:Date.now()-10000,user:{VPN:{MaxTier:0,Name:'Legacy cache',PlanName:'free'}}}})`,
  );
  const upgraded = await send("user");
  assert.equal(upgraded.success, true);
  assert.equal(upgraded.result.VPN.MaxTier, 2);
  const pm = await send("pmUser");
  assert.equal(pm.success, true);
  assert.equal(pm.result.Name, "Fixture");
  const cache = await evaluate(
    workerCall,
    `chrome.storage.local.get(['superVpn:user','superVpn:pmUser'])`,
  );
  assert.equal(cache["superVpn:user"].owner, "fixture");
  assert.equal(cache["superVpn:pmUser"].owner, "fixture");
  console.log(
    JSON.stringify({
      native: true,
      browser: browserInfo.Browser,
      checks: [
        "compiled-worker-start",
        "legacy-cache",
        "free-to-paid-refresh",
        "pm-user-normalization",
        "owned-cache",
      ],
      realNetwork: false,
    }),
  );
  await browserCall("Browser.close");
})()
  .catch((e) => {
    console.error("NATIVE TEST FAILED: " + e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const socket of sockets) socket.close();
    if (proc.exitCode === null) {
      proc.kill();
      await Promise.race([
        new Promise((resolve) => proc.once("close", resolve)),
        pause(3000),
      ]);
    }
    const target = path.resolve(temp),
      parent = path.resolve(os.tmpdir());
    if (
      path.dirname(target) !== parent ||
      !path.basename(target).startsWith("super-account-native-")
    )
      throw Error("Unexpected temporary path");
    fs.rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  });
