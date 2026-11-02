// Start the server sandbox on 58080 first. Test credentials are never logged.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const cachedBrowser = path.resolve(__dirname, "../../../../work/playwright-browsers");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(cachedBrowser)) process.env.PLAYWRIGHT_BROWSERS_PATH = cachedBrowser;
const deps = process.env.BUCKETS_TEST_NODE_MODULES || path.join(__dirname, "../../node_modules");
const esbuild = require(path.join(deps, "esbuild"));
const { chromium } = require(path.join(deps, "@playwright/test"));

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "buckets-ui-"));

  await esbuild.build({ entryPoints: [path.join(__dirname, "harness.tsx")], bundle: true, outfile: path.join(temp, "app.js"),
    jsx: "automatic", loader: { ".css": "css", ".module.css": "local-css" }, define: { "process.env.NODE_ENV": '"development"' } });
  const server = http.createServer((request, response) => {
    if (request.url === "/app.js" || request.url === "/app.css") {
      response.setHeader("Content-Type", request.url.endsWith("js") ? "text/javascript" : "text/css");
      response.end(fs.readFileSync(path.join(temp, request.url.slice(1))));
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end('<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
    }
  });
  await new Promise((resolve) => server.listen(Number(process.env.BUCKETS_TEST_PORT || 53001), "127.0.0.1", resolve));
  if (process.argv.includes("--serve")) {
    console.log("Local Buckets test console: http://127.0.0.1:53001 (use a generated sandbox key)");
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => { fs.rmSync(temp, { recursive: true, force: true }); process.exit(0); }));
    return;
  }
  if (process.argv.includes("--layout")) {
    const browser = await chromium.launch({ headless: true });
    try {
      await require("./layout.cjs")(browser, `http://127.0.0.1:${process.env.BUCKETS_TEST_PORT || 53001}`);
    } finally {
      await browser.close(); await new Promise((resolve) => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true });
    }
    return;
  }
  const credentials = JSON.parse(fs.readFileSync(process.env.BUCKETS_TEST_CREDENTIALS || path.resolve(__dirname, "../../../../InferencePort-Lightning/work/buckets-sandbox/credentials.json")));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(`http://127.0.0.1:${process.env.BUCKETS_TEST_PORT || 53001}`);
    await page.getByLabel("Sandbox API key").fill(credentials.user1_personal);
    await page.getByRole("button", { name: "Open sandbox" }).click();
    let name = "ui-e2e-" + randomUUID().slice(0, 12);
    await page.getByText("Create a bucket", { exact: true }).click();
    await page.getByLabel("Bucket name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Create bucket", exact: true }).click();
    let bucketRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name, exact: true }) });
    await bucketRow.getByRole("button", { name: "Browse", exact: true }).click();
    const contents = Buffer.alloc(9 * 1024 ** 2, 65);
    await page.getByLabel("Upload file").setInputFiles({ name: "ui-model.txt", mimeType: "text/plain", buffer: contents });
    const objectRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "ui-model.txt", exact: true }) });
    await objectRow.waitFor();
    const download = page.waitForEvent("download");
    await objectRow.getByRole("button", { name: "Download", exact: true }).click();
    const saved = await download;
    const file = path.join(temp, "download.txt"); await saved.saveAs(file);
    if (!fs.readFileSync(file).equals(contents)) throw new Error("Browser download mismatch");
    await bucketRow.getByRole("button", { name: "Settings", exact: true }).click();
    const renamed = name + "-edited";
    await page.getByLabel("New bucket name", { exact: true }).fill(renamed);
    await page.getByLabel("Maximum bucket size (GiB)").fill("20");
    await page.getByRole("button", { name: "Save settings", exact: true }).click();
    name = renamed;
    bucketRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name, exact: true }) });
    await bucketRow.waitFor();
    await page.getByRole("heading", { name, exact: true }).waitFor();
    await page.getByRole("tab", { name: "Credentials", exact: true }).click();
    await page.getByRole("button", { name: `Issue for ${name}`, exact: true }).click();
    await page.getByText("Copy this secret now. It will not be shown again.", { exact: true }).waitFor();
    const issuedAccessKey = await page.getByLabel("Access key ID").inputValue();
    await page.getByRole("button", { name: "Dismiss secret", exact: true }).click();
    const credentialItem = page.locator("li").filter({ hasText: issuedAccessKey });
    await credentialItem.getByRole("button", { name: "Revoke" }).click();
    await credentialItem.getByText("revoked").waitFor();
    await page.getByRole("tab", { name: "Files", exact: true }).click();
    await objectRow.getByRole("button", { name: "Delete", exact: true }).click();
    await objectRow.waitFor({ state: "detached" });
    await bucketRow.getByRole("button", { name: "Delete", exact: true }).click();
    await bucketRow.waitFor({ state: "detached" });
    console.log("PASS browser: authenticate sandbox, create/browse, multipart upload, download, reveal/dismiss credential, delete object/bucket");
    await context.close();
  } finally {
    await browser.close(); await new Promise((resolve) => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error.message); process.exit(1); });
