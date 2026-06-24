const SITE = 'https://client-eta-lovat-29.vercel.app';
const API = 'https://solargalaxy-api.onrender.com';

const html = await fetch(SITE).then((r) => r.text());
const m = html.match(/assets\/index-[^"']+\.js/);
const js = m ? await fetch(`${SITE}/${m[0]}`).then((r) => r.text()) : '';
console.log('bundle', m?.[0]);
console.log('has_render_api', js.includes('solargalaxy-api.onrender.com'));

// Simulate what browser does from Vercel origin
const r = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: SITE,
  },
  body: JSON.stringify({ login: 'admin', password: 'admin123' }),
});
console.log('cors_login', r.status, r.headers.get('access-control-allow-origin'));

// Wrong: Vercel /api path (old broken behavior)
const bad = await fetch(`${SITE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'admin', password: 'admin123' }),
}).catch((e) => ({ status: 'ERR', text: e.message }));
console.log('vercel_api_path', bad.status, typeof bad.text === 'function' ? await bad.text?.() : bad.text);
