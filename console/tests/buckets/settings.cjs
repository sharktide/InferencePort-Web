// Concurrent administrators must not accidentally republish private objects.
const assert = require('node:assert/strict');
module.exports = async function settings(browser, url) {
  const page = await browser.newPage();
  const owner = '11111111-1111-4111-8111-111111111111';
  const initial = { id: 'shared', name: 'shared', bytes_used: 8, bytes_reserved: 0, quota_bytes: 10737418240, status: 'active', visibility: 'public' };
  const rows = new Map([[initial.id, initial]]), patches = [], batches = [];
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
  await page.route('https://localhost:58080/**', async route => {
    const req = route.request(), target = new URL(req.url()), path = target.pathname, method = req.method();
    if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
    let data = {};
    if (path === '/v1/orgs') data = { orgs: [] };
    else if (path.endsWith('/workspace')) data = { owner_kind: 'user', owner_id: owner, endpoint: `https://localhost:58080/${owner}/s3/` };
    else if (path.endsWith('/status')) data = { status: 'available', object_writes_enabled: true, pricing: { status: 'verified' } };
    else if (path.endsWith('/s3-credentials')) data = { credentials: [] };
    else if (path.endsWith('/metadata')) {
      const ids = req.postDataJSON().ids; batches.push(ids);
      data = { buckets: ids.flatMap(id => rows.has(id) ? [rows.get(id)] : []) };
    } else if (path === '/v1/buckets' && method === 'POST') {
      const body = req.postDataJSON();
      data = { ...initial, ...body, id: body.name, visibility: body.visibility || 'private' };
      rows.set(data.id, data);
    } else if (path === '/v1/buckets') {
      // New buckets sort outside the first server page.
      data = { buckets: [rows.get('shared')], continuation_token: 'next-page' };
    } else if (path.endsWith('/objects')) data = { objects: [{ entry: 'file', object_key: 'file', size_bytes: 8, ...(rows.get('shared').visibility === 'public' ? { public_url: 'https://localhost:58080/public/buckets/shared/object?key=file' } : {}) }] };
    else if (path.endsWith('/usage')) data = { meters: [], settlements: [] };
    else if (method === 'PATCH') {
      const id = path.split('/').pop(), body = req.postDataJSON(); patches.push(body);
      data = { ...rows.get(id), ...body }; rows.set(id, data);
    }
    await route.fulfill({ json: data, headers: cors });
  });
  const row = name => page.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
  try {
    await page.goto(url);
    await page.getByLabel('Sandbox API key').fill('settings-fixture');
    await page.getByRole('button', { name: 'Open sandbox' }).click();
    await row('shared').getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByText('Public links permit anonymous downloads unless a bucket policy denies them.', { exact: false }).waitFor();
    rows.set('shared', { ...rows.get('shared'), visibility: 'private' });
    await page.getByLabel('Maximum bucket size (GiB)').fill('20');
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.deepEqual(patches, [{ quota_bytes: 21474836480 }]);
    assert.equal(rows.get('shared').visibility, 'private');
    rows.set('shared', { ...rows.get('shared'), visibility: 'public' });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await row('shared').getByRole('cell', { name: 'Active Public', exact: true }).waitFor();
    await row('shared').getByRole('button', { name: 'Browse', exact: true }).click();
    await page.getByRole('button', { name: 'Copy public URL', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Close dialog"]').disabled);
    rows.set('shared', { ...rows.get('shared'), visibility: 'private' });
    await page.getByRole('button', { name: 'Refresh', exact: true }).evaluate(button => button.click());
    await page.getByRole('button', { name: 'Copy public URL', exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    for (const name of ['new-first', 'new-second']) {
      await page.getByRole('button', { name: '+ Create bucket', exact: true }).click();
      await page.getByLabel('Bucket name', { exact: true }).fill(name);
      await page.getByRole('button', { name: 'Create bucket', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await row(name).waitFor();
    }
    await row('new-first').waitFor();
    assert(batches.some(ids => ids.includes('new-first') && ids.includes('new-second')));
    rows.delete('new-first');
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await row('new-first').waitFor({ state: 'hidden' });
    await row('new-second').waitFor();
    console.log('PASS settings: stale forms cannot republish, refresh hides revoked links, multiple off-page creations remain visible and external deletions disappear');
  } finally { await page.close(); }
};
