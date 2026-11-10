/** Browser regression: tab switches must not reload Rewards; user changes must reset it. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const esbuild = require("esbuild");

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "rewards-tab-"));
  let browser;
  let server;
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, "harness.tsx")],
      bundle: true,
      outfile: path.join(temp, "app.js"),
      jsx: "automatic",
      loader: { ".css": "css", ".module.css": "local-css" },
      define: { "process.env.NODE_ENV": '"development"' },
    });
    server = http.createServer((req, res) => {
      if (req.url === "/app.js" || req.url === "/app.css") {
        res.setHeader("Content-Type", req.url.endsWith(".js") ? "text/javascript" : "text/css");
        res.end(fs.readFileSync(path.join(temp, req.url.slice(1))));
      } else {
        res.setHeader("Content-Type", "text/html");
        res.end('<!doctype html><html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch();
    const page = await browser.newPage();
    const fetches = [];
    let claimed = false;

    await page.route("**/v1/rewards", async (route) => {
      fetches.push(route.request().headers().authorization);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        rewards: [{
          id: "test-reward", name: "E2E reward", description: "A claimable reward",
          icon: "⭐", tier: 1, category: "spend", chain: "spend",
          criteria: { type: "total_spend_usd", threshold: 10 },
          reward: { type: "percentage_discount", model_id: "gemini-4-carbon", discount_percent: 5, label: "5% off Gemini 4 Carbon" },
          progress: { current: 10, threshold: 10, percent: 100, earned: true, claimed },
        }],
        active_discounts: {}, stats_summary: { total_spend_usd: 10 }, opted_out: false,
      }) });
    });
    await page.route("**/v1/rewards/claim/test-reward", async (route) => {
      claimed = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto(origin);
    assert.equal(fetches.length, 0, "Rewards should load lazily, not on unrelated tabs");
    await page.getByRole("button", { name: "Rewards tab" }).click();
    await page.getByText("E2E reward").waitFor();
    assert.deepEqual(fetches, ["Bearer token-user-a"]);

    await page.getByRole("button", { name: "Other tab" }).click();
    await page.getByText("E2E reward").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Rewards tab" }).click();
    await page.getByText("E2E reward").waitFor({ state: "visible" });
    assert.equal(fetches.length, 1, "Returning to Rewards should not fetch again");

    await page.getByRole("button", { name: "Claim reward" }).click();
    await page.getByText("Claimed", { exact: true }).waitFor();
    assert.equal(fetches.length, 2, "Claiming should still refresh progress");
    await page.getByRole("button", { name: "Other tab" }).click();
    await page.getByRole("button", { name: "Rewards tab" }).click();
    await page.getByText("Claimed", { exact: true }).waitFor();
    assert.equal(fetches.length, 2, "Claimed progress must persist across tab switches");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Sign in as B" }).click();
    assert.equal(fetches.length, 2, "A new account must not eagerly load the previous account's rewards");
    await page.getByRole("button", { name: "Rewards tab" }).click();
    await page.getByText("E2E reward").waitFor();
    assert.deepEqual(fetches, ["Bearer token-user-a", "Bearer token-user-a", "Bearer token-user-b"]);
    console.log("PASS: lazy load, no reload on tab switch, claim refresh, user isolation");
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
