// Exercise the real OrgProvider while organization discovery and old requests lag.
const assert = require('node:assert/strict');
module.exports = async function workspace(browser, url) {
  const page = await browser.newPage();
  const user = '11111111-1111-4111-8111-111111111111';
  const org = '22222222-2222-4222-8222-222222222222';
  let releaseOrgs, orgStarted;
  const orgPending = new Promise(resolve => { releaseOrgs = resolve; });
  const orgSeen = new Promise(resolve => { orgStarted = resolve; });
  const calls = [];
  let releaseOld, oldStarted;
  const oldPending = new Promise(resolve => { releaseOld = resolve; });
  const oldSeen = new Promise(resolve => { oldStarted = resolve; });
  let delayOld = false;
  await page.addInitScript(() => localStorage.setItem('console-org', 'acme'));
  await page.route('https://localhost:58080/**', async route => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;
    const selected = req.headers()['x-inferenceport-org'] === 'acme';
    let data;
    if (pathname === '/v1/orgs') {
      orgStarted(); await orgPending;
      data = { orgs: [{ id: org, slug: 'acme', name: 'Acme', role: 'owner' }] };
    } else {
      calls.push({ pathname, selected });
      if (pathname.endsWith('/workspace')) data = { owner_id: selected ? org : user, owner_kind: selected ? 'org' : 'user' };
      else if (pathname.endsWith('/status')) data = { status: 'available', pricing: { status: 'unavailable' } };
      else if (pathname.endsWith('/s3-credentials')) data = { credentials: [] };
      else if (pathname === '/v1/buckets') {
        data = { buckets: [{ id: selected ? 'org-bucket' : 'personal-bucket', name: selected ? 'organization-only' : 'personal-only', status: 'active', quota_bytes: 100, bytes_used: 0 }] };
        if (selected && delayOld) { oldStarted(); await oldPending; }
      } else data = {};
    }
    await route.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  });
  try {
    await page.goto(url);
    await page.getByLabel('Sandbox API key').fill('workspace-fixture');
    await page.getByRole('button', { name: 'Open sandbox' }).click();
    await orgSeen;
    await page.getByText('Waiting for the selected organization.', { exact: false }).waitFor();
    assert.equal(calls.length, 0, 'No storage request may fall back to personal while an org is unresolved');
    releaseOrgs();
    await page.getByRole('cell', { name: 'organization-only', exact: true }).waitFor();
    assert(calls.every(call => call.selected));
    await page.getByRole('tab', { name: 'Connect', exact: true }).click();
    assert.equal(await page.getByLabel('S3 endpoint', { exact: true }).inputValue(), `https://localhost:58080/${org}/s3/`);
    delayOld = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await oldSeen;
    await page.getByRole('button', { name: 'Select Personal', exact: true }).click();
    await page.getByRole('cell', { name: 'personal-only', exact: true }).waitFor();
    releaseOld();
    await page.getByRole('tab', { name: 'Connect', exact: true }).click();
    assert.equal(await page.getByLabel('S3 endpoint', { exact: true }).inputValue(), `https://localhost:58080/${user}/s3/`);
    await page.getByRole('tab', { name: 'Files', exact: true }).click();
    assert.equal(await page.getByRole('cell', { name: 'organization-only', exact: true }).count(), 0);
    await page.getByRole('cell', { name: 'personal-only', exact: true }).waitFor();
    console.log('PASS workspace: unresolved org never falls back to personal; stale responses and connection URLs stay isolated after switching');
  } finally { releaseOrgs(); releaseOld(); await page.close(); }
};
