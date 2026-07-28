/**
 * Post-build prerender публичных маршрутов SPA (Puppeteer).
 * После vite build сохраняет HTML с реальным контентом для краулеров.
 */
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'client', 'dist');
const PAGES = JSON.parse(readFileSync(join(ROOT, 'client', 'seo', 'pages.json'), 'utf8'));
const SITE_ORIGIN = 'https://solargalaxy.kz';
const SITE_NAME = 'Solar Galaxy';
const OG_IMAGE = `${SITE_ORIGIN}/logo-full.png`;

const ROUTES = Object.keys(PAGES);
/** Главную перезаписываем последней — пока сервер отдаёт SPA-shell из index.html */
const ORDER = [...ROUTES.filter((r) => r !== '/'), '/'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function contentType(filePath) {
  return MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function startStaticServer(root, port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = join(root, urlPath);

        if (urlPath.endsWith('/')) {
          filePath = join(filePath, 'index.html');
        } else if (!extname(urlPath)) {
          const nested = join(root, urlPath.slice(1), 'index.html');
          filePath = existsSync(nested) ? nested : join(root, 'index.html');
        }

        if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          filePath = join(root, 'index.html');
        }

        res.writeHead(200, { 'Content-Type': contentType(filePath) });
        res.end(readFileSync(filePath));
      } catch {
        res.writeHead(500).end('error');
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function upsertTag(html, { pattern, replacement, fallbackAnchor, insertBeforeCloseHead }) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  if (fallbackAnchor && html.includes(fallbackAnchor)) {
    return html.replace(fallbackAnchor, `${replacement}\n    ${fallbackAnchor}`);
  }
  if (insertBeforeCloseHead) {
    return html.replace('</head>', `${replacement}\n  </head>`);
  }
  return html;
}

function injectHeadMeta(html, route) {
  const meta = PAGES[route];
  if (!meta) return html;

  const fullTitle = meta.title.includes(SITE_NAME)
    ? meta.title
    : `${meta.title} | ${SITE_NAME}`;
  const url = `${SITE_ORIGIN}${meta.path === '/' ? '/' : meta.path}`;

  let out = html;
  out = upsertTag(out, {
    pattern: /<title>[^<]*<\/title>/i,
    replacement: `<title>${fullTitle}</title>`,
    fallbackAnchor: '<meta charset="UTF-8" />',
  });
  out = upsertTag(out, {
    pattern: /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    replacement: `<meta name="description" content="${meta.description}" />`,
    insertBeforeCloseHead: true,
  });
  out = upsertTag(out, {
    pattern: /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
    replacement: '<meta name="robots" content="index, follow" />',
    insertBeforeCloseHead: true,
  });
  out = upsertTag(out, {
    pattern: /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    replacement: `<link rel="canonical" href="${url}" />`,
    insertBeforeCloseHead: true,
  });

  const ogTags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="ru_KZ" />`,
    `<meta property="og:title" content="${fullTitle}" />`,
    `<meta property="og:description" content="${meta.description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${fullTitle}" />`,
    `<meta name="twitter:description" content="${meta.description}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
  ].join('\n    ');

  out = out.replace(/<meta property="og:title"[^>]*>/i, '');
  out = out.replace(/<meta property="og:description"[^>]*>/i, '');
  out = out.replace(/<meta property="og:url"[^>]*>/i, '');
  out = out.replace(/<meta name="twitter:title"[^>]*>/i, '');
  out = out.replace(/<meta name="twitter:description"[^>]*>/i, '');

  if (!out.includes('property="og:title"')) {
    out = out.replace('</head>', `    ${ogTags}\n  </head>`);
  }

  return out;
}

function outPathForRoute(route) {
  if (route === '/') return join(DIST, 'index.html');
  const segment = route.replace(/^\//, '');
  return join(DIST, segment, 'index.html');
}

async function prerenderRoute(page, baseUrl, route) {
  const url = `${baseUrl}${route === '/' ? '/' : route}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForFunction(
    () => document.querySelector('meta[name="description"]')?.getAttribute('content')?.length > 20,
    { timeout: 10000 },
  ).catch(() => {});

  let html = await page.content();
  html = injectHeadMeta(html, route);

  const outFile = outPathForRoute(route);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html, 'utf8');

  const textLen = await page.evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').trim().length || 0);
  const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() || '');
  const h1Preview = h1.length > 50 ? `${h1.slice(0, 50)}…` : h1;
  console.log(`  ✓ ${route} → ${outFile.replace(DIST, '')} (${textLen} chars, h1: "${h1Preview}")`);
}

async function launchBrowser() {
  const systemChrome = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ].find((p) => p && existsSync(p));

  const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

  if (process.env.VERCEL || process.env.CI) {
    try {
      const chromium = await import('@sparticuz/chromium');
      const puppeteerCore = await import('puppeteer-core');
      return puppeteerCore.default.launch({
        args: [...chromium.default.args, ...launchArgs],
        defaultViewport: chromium.default.defaultViewport,
        executablePath: await chromium.default.executablePath(),
        headless: chromium.default.headless,
      });
    } catch (err) {
      console.warn('  @sparticuz/chromium unavailable:', err.message);
    }
  }

  if (systemChrome) {
    return puppeteer.launch({
      headless: true,
      executablePath: systemChrome,
      args: launchArgs,
    });
  }

  return puppeteer.launch({ headless: true, args: launchArgs });
}

async function main() {
  if (process.env.SKIP_PRERENDER === '1') {
    console.log('Prerender skipped (SKIP_PRERENDER=1)');
    return;
  }

  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('prerender: client/dist/index.html not found — run vite build first');
    process.exit(1);
  }

  const port = 4173 + Math.floor(Math.random() * 100);
  const server = await startStaticServer(DIST, port);
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log('Prerender public routes…');
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    for (const route of ORDER) {
      await prerenderRoute(page, baseUrl, route);
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('Prerender done.');
}

main().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
