/**
 * Генерация sitemap.xml при сборке клиента.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PAGES = JSON.parse(readFileSync(join(ROOT, 'client', 'seo', 'pages.json'), 'utf8'));
const OUT = join(ROOT, 'client', 'public', 'sitemap.xml');
const ORIGIN = 'https://solargalaxy.kz';
const TODAY = new Date().toISOString().slice(0, 10);

const PRIORITY = {
  '/': '1.0',
  '/about': '0.8',
  '/services': '0.9',
  '/contact': '0.8',
};

const CHANGEFREQ = {
  '/': 'weekly',
  '/about': 'monthly',
  '/services': 'monthly',
  '/contact': 'monthly',
};

const urls = Object.keys(PAGES).map((path) => {
  const loc = path === '/' ? `${ORIGIN}/` : `${ORIGIN}${path}`;
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${CHANGEFREQ[path] || 'monthly'}</changefreq>
    <priority>${PRIORITY[path] || '0.7'}</priority>
  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

writeFileSync(OUT, xml, 'utf8');
console.log(`sitemap.xml → ${OUT} (${Object.keys(PAGES).length} URLs)`);
