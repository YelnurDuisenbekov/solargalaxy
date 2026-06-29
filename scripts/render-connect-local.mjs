/**
 * Подключение локального server/.env к PostgreSQL на Render (external URL).
 *
 *   set RENDER_API_KEY=rnd_...   (Windows)
 *   npm run render:connect
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const API = 'https://api.render.com/v1';
const DB_NAME = 'solargalaxy-db';
const RENDER_API_URL = 'https://solargalaxy-api.onrender.com';

const apiKey = process.env.RENDER_API_KEY?.trim();
if (!apiKey) {
  console.error('Задайте RENDER_API_KEY (Render → Account Settings → API Keys)');
  process.exit(1);
}

async function api(pathname) {
  const res = await fetch(`${API}${pathname}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${pathname}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

function setEnvValue(filePath, key, value, comment) {
  const line = `${key}="${String(value).replace(/"/g, '\\"')}"`;
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const re = new RegExp(`^#?\\s*${key}=.*$`, 'm');
  const block = comment ? `${comment}\n${line}` : line;
  content = re.test(content)
    ? content.replace(re, block)
    : `${content.trimEnd()}\n${block}\n`;
  fs.writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`);
}

async function main() {
  console.log('Поиск БД', DB_NAME, '…');
  const list = await api('/postgres?limit=100');
  let pg = null;
  for (const item of list) {
    const db = item.postgres || item;
    if (db.name === DB_NAME) {
      pg = db;
      break;
    }
  }
  if (!pg) {
    throw new Error(`База «${DB_NAME}» не найдена в Render`);
  }

  console.log('Получение external connection string…');
  const info = await api(`/postgres/${pg.id}/connection-info`);
  const databaseUrl = info.externalConnectionString;
  if (!databaseUrl) {
    throw new Error('Render не вернул externalConnectionString');
  }

  const serverEnv = path.join(ROOT, 'server', '.env');
  const clientEnv = path.join(ROOT, 'client', '.env');

  setEnvValue(
    serverEnv,
    'DATABASE_URL',
    databaseUrl,
    '# PostgreSQL на Render (external, авто: npm run render:connect)',
  );
  setEnvValue(
    clientEnv,
    'VITE_API_URL',
    RENDER_API_URL,
    '# Локальный фронт → API на Render',
  );

  console.log('✓ server/.env → DATABASE_URL (Render external)');
  console.log('✓ client/.env → VITE_API_URL', RENDER_API_URL);
  console.log('\nДальше:');
  console.log('  cd server && npx prisma db push');
  console.log('  cd .. && npm run dev');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
