// Delayed committed mutations must be reconciled in their original workspace.
const assert = require('node:assert/strict');
const user = '11111111-1111-4111-8111-111111111111';
const org = '22222222-2222-4222-8222-222222222222';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS', 'Access-Control-Expose-Headers': 'ETag' };
module.exports = async function mutations(browser, url) {
  for (const remount of [false, true]) for (const scenario of ['issue', 'rotate', 'initiate', 'part', 'lost-initiate', 'lost-credential']) {
    const page = await browser.newPage();
    let release, started;
    const pending = new Promise(resolve => { release = resolve; });
    const seen = new Promise(resolve => { started = resolve; });
    const requests = [], requestKeys = [];
    let initiations = 0, issues = 0;
    await page.addInitScript(() => localStorage.setItem('console-org', 'acme'));
    const handler = async route => {
      const request = route.request(), target = new URL(request.url());
      const path = target.pathname, method = request.method();
      if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
      const selected = request.headers()['x-inferenceport-org'] === 'acme';
      requests.push({ path, method, selected, host: target.hostname, query: target.search });
      let data = {};
      if (path === '/v1/orgs') data = { orgs: [{ id: org, slug: 'acme', name: 'Acme', role: 'owner' }] };
      else if (path.endsWith('/workspace')) data = { owner_kind: selected ? 'org' : 'user', owner_id: selected ? org : user, endpoint: `https://storage.example.test/${selected ? org : user}/s3/` };
      else if (path.endsWith('/status')) data = { status: 'available', object_writes_enabled: true, pricing: { status: 'verified' } };
      else if (path.includes('/s3/')) {
        if (target.searchParams.has('uploads')) {
          initiations++; requestKeys.push(request.headers()['idempotency-key']);
          if (scenario === 'initiate') { started(); await pending; }
          if (scenario === 'lost-initiate' && initiations === 1) { await route.fulfill({ body: '<broken/>', headers: cors }); return; }
          await route.fulfill({ body: '<InitiateMultipartUploadResult><UploadId>fixture-upload</UploadId></InitiateMultipartUploadResult>', headers: cors }); return;
        }
        if (method === 'PUT' && scenario === 'part') { started(); await pending; }
        await route.fulfill({ status: method === 'DELETE' ? 204 : 200, body: '', headers: { ...cors, ETag: '"fixture-part"' } }); return;
      } else if ((path.endsWith('/s3-credentials') || path.endsWith('/rotate')) && method === 'POST') {
        issues++; requestKeys.push(request.headers()['idempotency-key']);
        if (scenario === 'lost-credential' && issues === 1) { await route.abort('failed'); return; }
        if (scenario === 'issue' || scenario === 'rotate') { started(); await pending; }
        data = { id: 'new-credential', access_key_id: 'IPB_FIXTURE_ONLY', secret_access_key: 'fixture-secret', expires_at: '2026-12-01' };
      } else if (path.endsWith('/s3-credentials')) data = { credentials: selected && scenario === 'rotate' ? [{ id: 'old-credential', access_key_id: 'IPB_OLD_FIXTURE', expires_at: '2026-12-01' }] : [], continuation_token: selected ? 'org-credentials-cursor' : null };
      else if (path.endsWith('/objects')) data = { objects: [] };
      else if (path.endsWith('/usage')) data = { meters: [], settlements: [] };
      else if (path === '/v1/buckets') data = { buckets: [{ id: 'fixture-bucket', name: selected ? 'organization-only' : 'personal-only', quota_bytes: 10737418240, bytes_used: 0, bytes_reserved: 0, status: 'active' }], continuation_token: selected ? 'org-buckets-cursor' : null };
      await route.fulfill({ status: method === 'DELETE' ? 204 : 200, ...(method === 'DELETE' ? {} : { json: data }), headers: cors });
    };
    await page.route('https://localhost:58080/**', handler);
    await page.route('https://storage.example.test/**', handler);
    try {
      await page.goto(url + (remount ? "?remount=1" : ""));
      await page.getByLabel('Sandbox API key').fill('mutation-fixture');
      await page.getByRole('button', { name: 'Open sandbox' }).click();
      await page.getByRole('cell', { name: 'organization-only', exact: true }).waitFor();
      if (['issue', 'rotate', 'lost-credential'].includes(scenario)) {
        await page.getByRole('tab', { name: 'Credentials', exact: true }).click();
        await page.getByRole('button', { name: scenario === 'rotate' ? 'Rotate key' : 'Issue workspace credential', exact: true }).click();
      } else {
        await page.getByRole('button', { name: 'Browse', exact: true }).click();
        await page.getByLabel('Upload file').setInputFiles({ name: 'fixture.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('fixture') });
      }
      if (scenario.startsWith('lost-')) {
        if (scenario === 'lost-credential') {
          await page.getByLabel('Secret access key', { exact: true }).waitFor();
          assert.equal(await page.getByLabel('Secret access key', { exact: true }).inputValue(), 'fixture-secret');
          assert.equal(issues, 2);
        } else {
          await page.getByRole('dialog').getByRole('status').filter({ hasText: 'Upload initiation returned no upload ID' }).waitFor();
          assert.equal(initiations, 2);
          assert(requests.some(r => r.method === 'DELETE' && r.query.includes('fixture-upload') && r.selected));
        }
        assert.equal(requestKeys.length, 2);
        assert(requestKeys[0] && requestKeys[0] === requestKeys[1], 'Reconciliation must reuse the request UUID');
      } else {
        await seen;
        if (['initiate', 'part'].includes(scenario)) {
          // The hardened dialog cannot dismiss an active transfer. Workspace
          // identity can still change externally (session/org refresh); exercise it
          // through the harness without pretending the backdrop is clickable.
          await page.keyboard.press('Escape');
          assert.equal(await page.getByRole('dialog').isVisible(), true);
        }
        const unavailable = scenario === 'issue' && !remount;
        const switcher = page.getByRole('button', { name: unavailable ? 'Select unavailable organization' : 'Select Personal', exact: true });
        if (['initiate', 'part'].includes(scenario)) await switcher.evaluate(button => button.click());
        else await switcher.click();
        if (unavailable) await page.getByRole('status').filter({ hasText: 'You no longer have access' }).waitFor();
        else await page.getByRole('cell', { name: 'personal-only', exact: true }).waitFor();
        const cleanup = page.waitForRequest(request => request.method() === 'DELETE' && (request.url().includes('new-credential') || request.url().includes('fixture-upload')));
        release();
        const request = await cleanup;
        assert.equal(request.headers()['x-inferenceport-org'], 'acme', 'Cleanup must retain the original organization');
        if (scenario === 'issue' || scenario === 'rotate') assert(request.url().includes('/s3-credentials/new-credential'));
        else assert(decodeURIComponent(request.url()).includes(`storage.example.test/${org}/s3/organization-only/fixture.bin`));
        assert.equal(await page.getByLabel('Secret access key', { exact: true }).count(), 0, 'Never reveal the previous workspace secret');
        assert.equal(await page.getByRole('button', { name: 'More buckets', exact: true }).count(), 0);
      }
    } finally { release(); await page.close(); }
  }
  console.log('PASS mutation recovery: original-workspace credential revocation, multipart abort, lost-response idempotency and configured endpoint');
};
