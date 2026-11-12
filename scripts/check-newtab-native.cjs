// Isolated native newtab validation: requires Playwright and CHROMIUM_PATH.
// Uses only generated notes, configuration and images in a temporary profile.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."),
  base = fs.mkdtempSync(path.join(os.tmpdir(), "super-newtab-audit-")),
  extension = path.join(base, "extension"),
  profile = path.join(base, "profile");
fs.mkdirSync(extension, { recursive: true });
for (const entry of ["newtab", "icons", "preferences.js"])
  fs.cpSync(path.join(root, entry), path.join(extension, entry), {
    recursive: true,
  });
fs.writeFileSync(
  path.join(extension, "manifest.json"),
  JSON.stringify({
    manifest_version: 3,
    name: "Isolated newtab audit",
    version: "1.0",
    permissions: ["storage", "unlimitedStorage"],
    background: { service_worker: "worker.js" },
  })
);
fs.writeFileSync(
  path.join(extension, "worker.js"),
  "chrome.runtime.onInstalled.addListener(()=>{});"
);
let browser;
const errors = [];
async function launch() {
  browser = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const w =
    browser.serviceWorkers()[0] ||
    (await browser.waitForEvent("serviceworker"));
  return w.url().split("/")[2];
}
async function main() {
  const id = await launch(),
    url = `chrome-extension://${id}/newtab/index.html`,
    page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(() =>
    chrome.storage.sync.set({
      "tabliss/config/locale": "en",
      "tabliss/config/background": {
        id: "audit-colour",
        key: "background/colour",
        display: { blur: 0, luminosity: 0 },
      },
      "tabliss/config/widget/default-time": null,
      "tabliss/config/widget/default-greeting": null,
      "tabliss/config/widget/note": {
        id: "note",
        key: "widget/notes",
        order: 0,
        display: { position: "topLeft" },
      },
      "tabliss/config/data/note": {
        notes: [{ contents: "Audit note preserved" }],
      },
    })
  );
  await page.reload();
  await page.locator(".Dashboard").waitFor();
  assert.ok(
    (await page.locator("body").innerText()).includes("Audit note preserved")
  );
  console.log("PASS existing configuration and notes");
  await page.keyboard.press("s");
  await page.locator(".Settings").waitFor();
  const snapshot = () => page.evaluate(() => chrome.storage.sync.get(null));
  await page
    .locator("select")
    .filter({ has: page.locator('option[value="widget/notes"]') })
    .selectOption("widget/notes");
  await page.waitForFunction(
    async () =>
      Object.entries(await chrome.storage.sync.get(null)).filter(
        ([k, v]) => k.startsWith("tabliss/config/widget/") && v
      ).length === 2
  );
  const added = Object.entries(await snapshot()).find(
    ([k, v]) => k.startsWith("tabliss/config/widget/") && v && v.id !== "note"
  )[1].id;
  await page.getByTitle("Move widget up", { exact: true }).click();
  await page.waitForFunction(
    async (id) =>
      (
        await chrome.storage.sync.get("tabliss/config/widget/" + id)
      )["tabliss/config/widget/" + id].order === 0,
    added
  );
  await page
    .locator("fieldset.Widget")
    .first()
    .getByTitle("Edit widget settings", { exact: true })
    .click();
  await page
    .locator("fieldset.Widget")
    .first()
    .getByText("Open Display Settings", { exact: true })
    .click();
  await page
    .locator("fieldset.Widget")
    .first()
    .locator(".PositionInput button")
    .last()
    .click();
  await page.waitForFunction(
    async (id) =>
      (
        await chrome.storage.sync.get("tabliss/config/widget/" + id)
      )["tabliss/config/widget/" + id].display.position === "bottomRight",
    added
  );
  await page
    .locator("fieldset.Widget")
    .first()
    .getByTitle("Remove widget", { exact: true })
    .click();
  await page.waitForFunction(
    async (id) =>
      (
        await chrome.storage.sync.get("tabliss/config/widget/" + id)
      )["tabliss/config/widget/" + id] === null,
    added
  );
  console.log("PASS add/reorder/remove widgets through editor");
  await page
    .locator("select")
    .filter({ has: page.locator('option[value="background/image"]') })
    .selectOption("background/image");
  await page
    .locator(".ImageSettings input[type=file]")
    .setInputFiles({
      name: "audit.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="green"/></svg>'
      ),
    });
  await page.locator(".ImageSettings img").waitFor();
  await page.waitForTimeout(300);
  await page.reload();
  await page.locator(".Dashboard").waitFor();
  await page.keyboard.press("s");
  await page.locator(".ImageSettings img").waitFor();
  assert.equal(
    await page
      .locator(".ImageSettings img")
      .evaluate((img) => img.complete && img.naturalWidth),
    32
  );
  console.log("PASS uploaded local image after reload");
  const second = await browser.newPage();
  second.on("pageerror", (e) => errors.push(e.message));
  await second.goto(url);
  await second.locator(".Dashboard").waitFor();
  await page
    .locator("select")
    .filter({ has: page.locator('option[value="pt-BR"]') })
    .selectOption("pt-BR");
  await second.waitForFunction(() => document.documentElement.lang === "pt-BR");
  await page
    .locator("select")
    .filter({ has: page.locator('option[value="pt-BR"]') })
    .selectOption("en");
  await second.waitForFunction(() => document.documentElement.lang === "en");
  console.log("PASS shared language in two real tabs");
  const downloadEvent = page.waitForEvent("download");
  await page.getByText("export", { exact: true }).click();
  const download = await downloadEvent;
  const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  assert.equal(exported.version, 3);
  assert.equal(exported["data/note"].notes[0].contents, "Audit note preserved");
  const before = await snapshot();
  const alertEvent = page.waitForEvent("dialog");
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByText("Import", { exact: true }).click();
  await (
    await chooserEvent
  ).setFiles({
    name: "future.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 999 })),
  });
  const alert = await alertEvent;
  assert.match(alert.message(), /Invalid import/);
  await alert.dismiss();
  assert.deepEqual(await snapshot(), before);
  assert.equal(
    await page
      .locator(".ImageSettings img")
      .evaluate((img) => img.complete && img.naturalWidth),
    32
  );
  console.log(
    "PASS export and rejected future import preserves settings/image"
  );
  const validChooser = page.waitForEvent("filechooser");
  await page.getByText("Import", { exact: true }).click();
  await (
    await validChooser
  ).setFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".ImageSettings") &&
      !document.querySelector(".ImageSettings img")
  );
  console.log("PASS valid configuration import");
  // Valid imports intentionally clear image cache; upload again to test a durable restart.
  await page
    .locator(".ImageSettings input[type=file]")
    .setInputFiles({
      name: "restart.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="blue"/></svg>'
      ),
    });
  await page.locator(".ImageSettings img").waitFor();
  await page.waitForTimeout(300);
  await browser.close();
  const restarted = await launch();
  assert.equal(restarted, id);
  const reopened = await browser.newPage();
  await reopened.goto(url);
  await reopened.locator(".Dashboard").waitFor();
  assert.ok(
    (await reopened.locator("body").innerText()).includes(
      "Audit note preserved"
    )
  );
  await reopened.keyboard.press("s");
  await reopened.locator(".ImageSettings img").waitFor();
  assert.equal(
    await reopened
      .locator(".ImageSettings img")
      .evaluate((img) => img.complete && img.naturalWidth),
    48
  );
  console.log(
    "PASS notes, configuration and local image after browser restart"
  );
  console.log("BROWSER", browser.browser().version());
  assert.deepEqual(errors, []);
}
main()
  .catch((e) => {
    console.error(e.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    fs.rmSync(base, { recursive: true, force: true });
  });
