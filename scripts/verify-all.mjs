const SITE = 'https://client-eta-lovat-29.vercel.app';
const API = 'https://solargalaxy-api.onrender.com';

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log('OK  ', name);
  } catch (e) {
    checks.push({ name, ok: false, err: e.message });
    console.log('FAIL', name, '-', e.message);
  }
}

await check('Render API health', async () => {
  const r = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(120000) });
  const d = await r.json();
  if (r.status !== 200 || d.status !== 'ok') throw new Error(JSON.stringify(d));
});

await check('Vercel site opens', async () => {
  const r = await fetch(SITE, { signal: AbortSignal.timeout(30000) });
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  const html = await r.text();
  if (!html.includes('Senergy')) throw new Error('no title');
});

await check('Vercel bundle has Render API URL', async () => {
  const html = await fetch(SITE).then((r) => r.text());
  const m = html.match(/assets\/index-[^"']+\.js/);
  if (!m) throw new Error('bundle not found');
  const js = await fetch(`${SITE}/${m[0]}`).then((r) => r.text());
  if (!js.includes('solargalaxy-api.onrender.com')) throw new Error('API URL missing in build');
});

await check('Vercel /login page', async () => {
  const r = await fetch(`${SITE}/login`);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
});

for (const [login, password, label] of [
  ['admin', 'admin123', 'staff admin'],
  ['menedzher1', 'menedzher123', 'staff manager'],
  ['+7 700 000 0060', 'klient123', 'client phone'],
]) {
  await check(`Login ${label}`, async () => {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SITE },
      body: JSON.stringify({ login, password }),
      signal: AbortSignal.timeout(120000),
    });
    const d = await r.json();
    if (r.status !== 200 || !d.token) throw new Error(d.error || `status ${r.status}`);
  });
}

await check('Public lead endpoint', async () => {
  const r = await fetch(`${API}/api/public/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE },
    body: JSON.stringify({
      fullName: 'Test Verify',
      phone: '+7 777 999 8877',
      city: 'Шымкент',
      source: 'verify-script',
    }),
    signal: AbortSignal.timeout(120000),
  });
  const d = await r.json();
  if (r.status !== 201 && r.status !== 200) throw new Error(d.error || `status ${r.status}`);
});

await check('GitHub render.yaml exists', async () => {
  const r = await fetch('https://raw.githubusercontent.com/YelnurDuisenbekov/solargalaxy/main/render.yaml');
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  const t = await r.text();
  if (!t.includes('solargalaxy-api')) throw new Error('render.yaml missing service');
});

const failed = checks.filter((c) => !c.ok);
console.log('\n---');
console.log(`Итого: ${checks.length - failed.length}/${checks.length} OK`);
if (failed.length) process.exit(1);
