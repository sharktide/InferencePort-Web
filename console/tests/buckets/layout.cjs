// Layout regression uses the production stylesheet and deterministic API fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function layout(browser, url) {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) for (const populated of [false, true]) for (const pricesReady of (populated ? [false, true] : [false])) {
    let aborted = 0, completed = 0;
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    try {
      await page.route('https://localhost:58080/**', async (route) => {
        const target = new URL(route.request().url());
        const pathname = target.pathname;
        if (pathname.includes('/s3/')) {
          const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' };
          if (route.request().method() === 'DELETE') { aborted++; await route.fulfill({ status: 204, headers }); }
          else if (route.request().method() === 'PUT') await route.fulfill({ status: 200, body: '', headers: { ...headers, ETag: '"receipt-hidden-by-cors"' } });
          else if (target.searchParams.has('uploads')) await route.fulfill({ body: '<InitiateMultipartUploadResult><UploadId>receipt-test</UploadId></InitiateMultipartUploadResult>', headers });
          else { completed++; await route.fulfill({ body: '<CompleteMultipartUploadResult/>', headers }); }
          return;
        }
        const bucket = { id: 'fixture', name: 'hi-test', bytes_used: 8388608, bytes_reserved: 0, quota_bytes: 10737418240, status: 'active' };
        let data = { orgs: [] };
        if (pathname.endsWith('/workspace')) data = { owner_kind: 'user', owner_id: '11111111-1111-4111-8111-111111111111', endpoint: 'https://localhost:58080/11111111-1111-4111-8111-111111111111/s3/' };
        else if (pathname.endsWith('/status')) data = { status: 'available', object_writes_enabled: pricesReady, pricing: pricesReady ? { status: 'verified', rate_version: 'a'.repeat(64), meters: { capacity: { name: 'Stored data', unit: '1 GB/Month', bands: [['0', '0.0312']], effective_at: '2026-11-01' } } } : { status: 'unavailable' } };
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
      assert.equal(await page.getByRole('tab', { name: 'Files', exact: true }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByLabel('S3 endpoint', { exact: true }).isVisible(), false);
      if (populated) await page.getByRole('button', { name: 'Browse', exact: true }).click();
      else await page.getByText('No buckets yet. Use Create bucket to get started.').waitFor();
      if (populated) {
        await page.waitForFunction((disabled) => document.querySelector('input[aria-label="Upload file"]')?.disabled === disabled, !pricesReady);
        assert.equal(await page.getByLabel('Upload file').isDisabled(), !pricesReady, 'Upload availability must reflect verified pricing');
      }
      if (populated) await page.getByRole('button', { name: 'Close dialog' }).click();
      assert.equal(await page.getByLabel('Bucket name', { exact: true }).count(), 0);
      await page.getByRole('button', { name: /Create bucket/ }).click();
      await page.getByRole('dialog', { name: 'Create a bucket' }).waitFor();
      const name = await page.getByLabel('Bucket name', { exact: true }).boundingBox();
      const quota = await page.getByLabel('Quota (GiB)').boundingBox();
      assert(name && quota);
      if (width > 700) assert(Math.abs(name.y - quota.y) < 2, 'Desktop creation fields must share a row');
      else assert(quota.y >= name.y + name.height, 'Mobile creation fields must stack');
      if (width > 700) {
        assert(await page.locator('table').first().evaluate((table) => parseFloat(getComputedStyle(table.querySelector('th')).paddingLeft) >= 12), 'Table headings need cell padding');
      }
      assert(await page.getByRole('dialog').evaluate((element) => element.getBoundingClientRect().width <= innerWidth), 'Modal must fit viewport');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Wide content must scroll within its table, not the page');
      // Escape closes an idle dialog; busy dialogs must not be dismissed mid-mutation.
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: /Create bucket/ }).click();
      await page.getByRole('dialog', { name: 'Create a bucket' }).waitFor();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      if (populated && pricesReady && width === 1440 && theme === 'dark') {
        await page.getByRole('button', { name: 'Browse', exact: true }).click();
        await page.getByLabel('Upload file').setInputFiles({ name: 'hidden-receipt.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('part') });
        await page.getByRole('status').filter({ hasText: 'missing its part receipt' }).first().waitFor();
        assert.equal(aborted, 1);
        assert.equal(completed, 0, 'Missing ETag must never submit an invalid CompleteMultipartUpload');
        await page.keyboard.press('Escape');
      }
      await page.getByRole('tab', { name: 'Credentials', exact: true }).click();
      const checkbox = page.getByRole('checkbox', { name: 'Read only' });
      assert(await checkbox.isChecked());
      const box = await checkbox.boundingBox();
      const label = await checkbox.locator('..').boundingBox();
      assert(box.width <= 20 && Math.abs(box.x - label.x) < 2 && Math.abs(box.y + box.height / 2 - label.y - label.height / 2) < 2, 'Checkbox stays next to its label');
      await page.getByRole('tab', { name: 'Connect', exact: true }).click();
      assert.equal(await page.getByLabel('S3 endpoint', { exact: true }).inputValue(), 'https://localhost:58080/11111111-1111-4111-8111-111111111111/s3');
      if (populated) {
        assert.equal(await page.getByLabel('Connection bucket').inputValue(), 'hi-test');
        assert.equal(await page.getByLabel('Bucket URI', { exact: true }).inputValue(), 's3://hi-test/');
        assert.equal(await page.getByLabel('Bucket request URL', { exact: true }).inputValue(), 'https://localhost:58080/11111111-1111-4111-8111-111111111111/s3/hi-test/');
        const listCommand = await page.getByRole('heading', { name: 'List files', exact: true }).locator('../..').locator('pre').textContent();
        assert(listCommand.includes("--endpoint-url 'https://localhost:58080/11111111-1111-4111-8111-111111111111/s3' s3 ls 's3://hi-test/'"));
      }
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.getByRole('button', { name: 'Copy s3 endpoint', exact: true }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://localhost:58080/11111111-1111-4111-8111-111111111111/s3');
      await page.getByText('Getting 403 Forbidden?', { exact: true }).click();
      await page.getByText('An access-log status alone does not identify the cause.', { exact: false }).waitFor();
      await page.getByRole('button', { name: 'S3 credentials', exact: true }).click();
      assert.equal(await page.getByRole('tab', { name: 'Credentials', exact: true }).getAttribute('aria-selected'), 'true');
      await page.getByRole('tab', { name: 'Pricing', exact: true }).click();
      await page.getByRole('heading', { name: 'Storage pricing', exact: true }).waitFor();
      if (pricesReady) {
        await page.getByText('$0.0312', { exact: true }).waitFor();
        assert.equal(await page.getByText('Technical rate version').count(), 1);
      }
      assert.equal(await page.getByLabel('Bucket name', { exact: true }).count(), 0);
      await page.getByRole('tab', { name: 'Pricing', exact: true }).press('Home');
      assert.equal(await page.getByRole('tab', { name: 'Files', exact: true }).getAttribute('aria-selected'), 'true');
      if (process.env.BUCKETS_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.BUCKETS_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.BUCKETS_SCREENSHOT_DIR, `${width}-${theme}-${populated ? 'populated' : 'empty'}-${pricesReady ? 'priced' : 'unpriced'}.png`), fullPage: true });
      }
    } finally { await page.close(); }
  }
  await require('./workspace.cjs')(browser, url);
  await require('./mutations.cjs')(browser, url);
  await require('./settings.cjs')(browser, url);
  console.log('PASS layout: real console CSS, desktop/mobile, light/dark, empty/populated, aligned forms, checkbox and confined table scrolling');
};
