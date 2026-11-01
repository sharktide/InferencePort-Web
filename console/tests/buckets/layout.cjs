// Layout regression uses the production stylesheet and deterministic API fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function layout(browser, url) {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) for (const populated of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    try {
      await page.route('https://localhost:58080/**', async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const bucket = { id: 'fixture', name: 'hi-test', bytes_used: 8388608, bytes_reserved: 0, quota_bytes: 10737418240, status: 'active' };
        let data = { orgs: [] };
        if (pathname.endsWith('/status')) data = { status: 'private_beta', pricing: populated ? { rate_version: 'a'.repeat(64), meters: { capacity: { name: 'Hot LRS Data Stored', unit: '1 GB/Month', bands: [['0', '0.0208']], effective_at: '2026-11-01' } } } : {} };
        else if (pathname.endsWith('/s3-credentials')) data = { credentials: populated ? [{ id: 'key', access_key_id: 'IPB_EXAMPLE_ONLY', expires_at: '2026-11-02T00:00:00Z', revoked_at: null }] : [] };
        else if (pathname.endsWith('/objects')) data = { objects: [{ entry: 'models/' + 'long-model-name-'.repeat(10) + '.bin', size_bytes: 8388608 }] };
        else if (pathname.endsWith('/usage')) data = { meters: [], settlements: [], held_credits: '0', carried_credits: '0', debited_credits: '0' };
        else if (pathname === '/v1/buckets') data = { buckets: populated ? [bucket] : [] };
        await route.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
      });
      await page.goto(url);
      await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
      await page.getByLabel('Sandbox API key').fill('layout-fixture');
      await page.getByRole('button', { name: 'Open sandbox' }).click();
      await page.getByText('Read only', { exact: true }).waitFor();
      if (populated) await page.getByRole('button', { name: 'Browse', exact: true }).click();
      else await page.getByText('No buckets yet. Create a bucket to start storing files.').waitFor();
      assert.equal(await page.getByLabel('S3 endpoint', { exact: true }).inputValue(), 'https://localhost:58080/s3/');
      if (populated) {
        assert.equal(await page.getByLabel('Connection bucket').inputValue(), 'hi-test');
        assert.equal(await page.getByLabel('Bucket URI', { exact: true }).inputValue(), 's3://hi-test/');
        assert.equal(await page.getByLabel('Bucket request URL', { exact: true }).inputValue(), 'https://localhost:58080/s3/hi-test/');
        const listCommand = await page.getByRole('heading', { name: 'List files', exact: true }).locator('../..').locator('pre').textContent();
        assert(listCommand.includes("--endpoint-url 'https://localhost:58080/s3/' s3 ls 's3://hi-test/'"));
      }
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.getByRole('button', { name: 'Copy s3 endpoint', exact: true }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://localhost:58080/s3/');
      await page.getByText('Getting 403 Forbidden?', { exact: true }).click();
      await page.getByText('An access-log status alone does not identify the cause.', { exact: false }).waitFor();
      const name = await page.getByLabel('Bucket name', { exact: true }).boundingBox();
      const quota = await page.getByLabel('Quota (GiB)').boundingBox();
      assert(name && quota);
      if (width > 700) assert(Math.abs(name.y - quota.y) < 2, 'Desktop creation fields must share a row');
      else assert(quota.y >= name.y + name.height, 'Mobile creation fields must stack');
      const checkbox = page.getByRole('checkbox', { name: 'Read only' });
      assert(await checkbox.isChecked());
      const box = await checkbox.boundingBox();
      const label = await checkbox.locator('..').boundingBox();
      assert(box.width <= 20 && Math.abs(box.x - label.x) < 2 && Math.abs(box.y + box.height / 2 - label.y - label.height / 2) < 2, 'Checkbox stays next to its label');
      assert(await page.locator('table').first().evaluate((table) => parseFloat(getComputedStyle(table.querySelector('th')).paddingLeft) >= 12), 'Table headings need cell padding');
      assert(await page.locator('table').evaluateAll((tables) => tables.every((table) => [...table.querySelectorAll('th')].every((cell) => cell.scrollWidth <= cell.clientWidth))), 'Table headings must fit their cells');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Wide content must scroll within its table, not the page');
      if (process.env.BUCKETS_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.BUCKETS_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.BUCKETS_SCREENSHOT_DIR, `${width}-${theme}-${populated ? 'populated' : 'empty'}.png`), fullPage: true });
      }
    } finally { await page.close(); }
  }
  console.log('PASS layout: real console CSS, desktop/mobile, light/dark, empty/populated, aligned forms, checkbox and confined table scrolling');
};
