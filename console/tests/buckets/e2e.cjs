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
    jsx: "automatic", loader: { ".css": "local-css" }, define: { "process.env.NODE_ENV": '"development"' } });
  const server = http.createServer((request, response) => {
    if (request.url === "/app.js" || request.url === "/app.css") {
      response.setHeader("Content-Type", request.url.endsWith("js") ? "text/javascript" : "text/css");
      response.end(fs.readFileSync(path.join(temp, request.url.slice(1))));
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end('<!doctype html><html><head><link rel="stylesheet" href="/app.css"><style>body{font-family:system-ui;color:#182025;background:#f6f7fa}input,button{padding:8px;margin:5px}table{width:100%;text-align:left}td,th{padding:8px}section{padding:20px;margin:15px;background:white;border:1px solid #ddd} :root{--text:#182025;--text-2:#46525f;--surface:white;--surface-2:#f4f6f8;--border:#ddd;--r-2:8px;--r-1:4px}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
    }
  });
  await new Promise((resolve) => server.listen(53001, "127.0.0.1", resolve));
  if (process.argv.includes("--serve")) {
    console.log("Local Buckets test console: http://127.0.0.1:53001 (use a generated sandbox key)");
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => { fs.rmSync(temp, { recursive: true, force: true }); process.exit(0); }));
    return;
  }
  const credentials = JSON.parse(fs.readFileSync(process.env.BUCKETS_TEST_CREDENTIALS || path.resolve(__dirname, "../../../../InferencePort-Lightning/work/buckets-sandbox/credentials.json")));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("http://127.0.0.1:53001");
    await page.getByLabel("Sandbox API key").fill(credentials.user1_personal);
    await page.getByRole("button", { name: "Open sandbox" }).click();
    const name = "ui-e2e-" + randomUUID().slice(0, 12);
    await page.getByLabel("Bucket name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Create bucket", exact: true }).click();
    const bucketRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name, exact: true }) });
    await bucketRow.getByRole("button", { name: "Browse", exact: true }).click();
    await page.getByLabel("Upload file").setInputFiles({ name: "ui-model.txt", mimeType: "text/plain", buffer: Buffer.from("browser model weights") });
    const objectRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "ui-model.txt", exact: true }) });
    await objectRow.waitFor();
    const download = page.waitForEvent("download");
    await objectRow.getByRole("button", { name: "Download", exact: true }).click();
    const saved = await download;
    const file = path.join(temp, "download.txt"); await saved.saveAs(file);
    if (fs.readFileSync(file, "utf8") !== "browser model weights") throw new Error("Browser download mismatch");
    await page.getByRole("button", { name: `Issue for ${name}`, exact: true }).click();
    await page.getByText("Copy this secret now. It will not be shown again.", { exact: true }).waitFor();
    const issuedAccessKey = await page.getByLabel("Access key ID").inputValue();
    await page.getByRole("button", { name: "Dismiss secret", exact: true }).click();
    const credentialItem = page.locator("li").filter({ hasText: issuedAccessKey });
    await credentialItem.getByRole("button", { name: "Revoke" }).click();
    await credentialItem.getByText("revoked").waitFor();
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
