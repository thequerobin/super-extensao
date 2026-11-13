// Isolated native return test: real DNR redirects and compiled blocking page, local server only.
// The connected status is simulated; this does not test a real VPN connection.
// Set CHROMIUM_PATH to override the local Chromium/Edge executable.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process"),
  assert = require("node:assert/strict");
const http = require("node:http"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "super-return-native-")),
  extension = path.join(temp, "extension"),
  profile = path.join(temp, "profile");
fs.mkdirSync(extension);
fs.mkdirSync(profile);
fs.mkdirSync(path.join(root, "work"), { recursive: true });
const requests = [];
let server, browserControl;
for (const file of [
  "vpn-blocked.html",
  "vpn-blocked.css",
  "ui-theme.css",
  "ui-components.css",
  "preferences.js",
  "vpn/blocked.js",
]) {
  const target = path.join(extension, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
const sources = {
  guard: "vpn/engine/network-guard.ts",
  native: "vendor/proton-source/source/js/vpn/networkGuard.ts",
};
const factories = Object.entries(sources)
  .map(
    ([name, file]) =>
      JSON.stringify(name) +
      ":function(module,exports,require){" +
      ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      }).outputText +
      "}",
  )
  .join(",");
fs.writeFileSync(
  path.join(extension, "manifest.json"),
  JSON.stringify({
    manifest_version: 3,
    name: "Isolated return test",
    version: "1.0",
    permissions: ["storage", "declarativeNetRequest"],
    host_permissions: ["<all_urls>"],
    background: { service_worker: "worker.js" },
    web_accessible_resources: [
      { resources: ["vpn-blocked.html"], matches: ["<all_urls>"] },
    ],
  }),
);
fs.writeFileSync(
  path.join(extension, "worker.js"),
  "const modules={" +
    factories +
    '},cache={};function require(id){id=id.includes("network-guard")?"guard":id;if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,require);return m.exports;}globalThis.safety=require("native").networkGuard;chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(message.channel!=="super-vpn"||message.type!=="protectionStatus")return;void safety.status().then(state=>reply({received:true,result:{status:state.blocked?"blocked":state.armed?"connected":"released",retryAvailable:false}}));return true;});',
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
    "--host-resolver-rules=EXCLUDE 127.0.0.1,MAP * ~NOTFOUND",
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
    if (msg.method === "Network.loadingFailed")
      console.error(JSON.stringify({ networkFailure: msg.params.errorText }));
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
  assert.ok(port, "DevTools startup");
  let worker;
  for (let i = 0; i < 100; i++) {
    const all = await (
      await fetch("http://127.0.0.1:" + port + "/json/list")
    ).json();
    worker = all.find(
      (t) => t.type === "service_worker" && t.url.endsWith("/worker.js"),
    );
    if (worker) break;
    await pause(100);
  }
  assert.ok(worker);
  const workerCall = await connect(worker.webSocketDebuggerUrl);
  let ready = false;
  for (let i = 0; i < 100; i++) {
    ready = await evaluate(workerCall, 'typeof safety !== "undefined"');
    if (ready) break;
    await pause(100);
  }
  assert.ok(ready, "guard ready");
  server = http.createServer((req, res) => {
    if (req.url !== "/favicon.ico")
      requests.push({ method: req.method, url: req.url });
    res.end("<!doctype html><title>Returned</title><p>LOCAL TEST</p>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port,
    target =
      origin + "/page?q=a%26b&next=https%3A%2F%2Fexample.test%2F#section";
  const info = await (
      await fetch("http://127.0.0.1:" + port + "/json/version")
    ).json(),
    browserCall = await connect(info.webSocketDebuggerUrl);
  browserControl = browserCall;
  await evaluate(workerCall, "safety.block()");
  const created = await browserCall("Target.createTarget", { url: target });
  let page;
  for (let i = 0; i < 100; i++) {
    const all = await (
      await fetch("http://127.0.0.1:" + port + "/json/list")
    ).json();
    page = all.find((t) => t.id === created.targetId);
    if (page) break;
    await pause(100);
  }
  assert.ok(page);
  const pageCall = await connect(page.webSocketDebuggerUrl);
  await pageCall("Network.enable");
  async function waitFor(expression) {
    for (let i = 0; i < 100; i++) {
      try {
        const value = await evaluate(pageCall, expression);
        if (value) return value;
      } catch {}
      await pause(100);
    }
    console.error(
      JSON.stringify({
        page: await evaluate(
          pageCall,
          '({href:location.href,title:document.title,status:document.querySelector("main")?.dataset.status,error:document.querySelector("#error")?.textContent})',
        ),
        requests,
        guard: await evaluate(workerCall, "safety.status()"),
      }),
    );
    throw Error("Timeout: " + expression);
  }
  await waitFor('document.querySelector("main")?.dataset.status === "blocked"');
  const redirected = await evaluate(pageCall, "location.href");
  assert.ok(
    redirected.includes(
      "/vpn-blocked.html#return=" +
        origin +
        "/page?q=a%26b&next=https%3A%2F%2Fexample.test%2F",
    ),
  );
  assert.equal(requests.length, 0);
  assert.equal(
    await evaluate(pageCall, 'document.querySelector("#return").hidden'),
    true,
  );
  await evaluate(workerCall, "safety.open(async()=>true)");
  await waitFor(
    'document.querySelector("main")?.dataset.status === "connected" && !document.querySelector("#return").hidden',
  );
  const screenshot = await pageCall("Page.captureScreenshot", {
    format: "png",
  });
  fs.writeFileSync(
    path.join(root, "work/vpn-return-native.png"),
    Buffer.from(screenshot.data, "base64"),
  );
  assert.equal(requests.length, 0);
  await waitFor('!document.querySelector("#return").disabled');
  await evaluate(pageCall, 'document.querySelector("#return").click()');
  await waitFor('document.title === "Returned"');
  const returned = await evaluate(pageCall, "location.href");
  assert.equal(returned, redirected.slice(redirected.indexOf("#return=") + 8));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "GET");
  await evaluate(workerCall, "safety.block()");
  await evaluate(
    pageCall,
    '(()=>{const form=document.createElement("form");form.method="post";form.action=' +
      JSON.stringify(origin + "/post") +
      ";document.body.append(form);form.submit();})()",
  );
  await waitFor('document.querySelector("main")?.dataset.status === "blocked"');
  assert.equal(await evaluate(pageCall, "location.hash"), "");
  assert.equal(requests.length, 1);
  await evaluate(workerCall, "safety.open(async()=>true)");
  await waitFor(
    'document.querySelector("main")?.dataset.status === "connected"',
  );
  assert.equal(
    await evaluate(pageCall, 'document.querySelector("#return").hidden'),
    true,
  );
  assert.equal(requests.length, 1);
  console.log(
    JSON.stringify({
      native: true,
      browser: info.Browser,
      checks: [
        "GET-redirect-keeps-local-target",
        "no-request-before-click",
        "return-button-after-confirmation",
        "explicit-return-GET",
        "POST-not-replayed",
      ],
      anchorPreserved: returned === target,
    }),
  );
})()
  .catch((e) => {
    console.error("NATIVE TEST FAILED: " + e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browserControl) await browserControl("Browser.close").catch(() => {});
    for (const socket of sockets) socket.close();
    if (proc.exitCode === null) {
      await Promise.race([
        new Promise((resolve) => proc.once("close", resolve)),
        pause(3000),
      ]);
    }
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    if (proc.exitCode === null) {
      proc.kill();
      await pause(1000);
    }
    const target = path.resolve(temp),
      parent = path.resolve(os.tmpdir());
    if (
      path.dirname(target) !== parent ||
      !path.basename(target).startsWith("super-return-native-")
    )
      throw Error("Unexpected temporary path");
    fs.rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  });
