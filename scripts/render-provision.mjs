/**
 * Настройка Render после Blueprint: Green API env + redeploy.
 * Использование:
 *   set RENDER_API_KEY=rnd_...   (Windows)
 *   node scripts/render-provision.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'solargalaxy-api';

const apiKey = process.env.RENDER_API_KEY?.trim();
if (!apiKey) {
  console.error('Задайте RENDER_API_KEY (Render → Account Settings → API Keys)');
  process.exit(1);
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function api(pathname, options = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
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

async function findService() {
  const list = await api('/services?limit=100');
  for (const item of list) {
    const svc = item.service || item;
    if (svc.name === SERVICE_NAME) return svc;
  }
  return null;
}

async function setEnvVar(serviceId, key, value) {
  await api(`/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
  console.log(`  ✓ ${key}`);
}

async function main() {
  console.log('Поиск сервиса', SERVICE_NAME, '…');
  const service = await findService();
  if (!service) {
    console.error(`
Сервис «${SERVICE_NAME}» не найден.
Сначала в Render: New → Blueprint → репозиторий solargalaxy → Apply.
`);
    process.exit(1);
  }

  console.log('Найден:', service.id, service.serviceDetails?.url || '');

  const env = loadDotEnv(path.join(ROOT, 'server', '.env'));
  const toSet = {
    WHATSAPP_PROVIDER: 'green',
    GREEN_API_ID_INSTANCE: env.GREEN_API_ID_INSTANCE,
    GREEN_API_TOKEN: env.GREEN_API_TOKEN,
    GREEN_API_URL: env.GREEN_API_URL || 'https://api.green-api.com',
    WHATSAPP_BUSINESS_PHONE: env.WHATSAPP_BUSINESS_PHONE,
    CLIENT_URL: 'http://localhost:5173,https://client-eta-lovat-29.vercel.app',
  };

  console.log('Обновление переменных окружения…');
  for (const [key, value] of Object.entries(toSet)) {
    if (!value) {
      console.log(`  − ${key} (пропуск — пусто)`);
      continue;
    }
    await setEnvVar(service.id, key, value);
  }

  console.log('Запуск деплоя…');
  await api(`/services/${service.id}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'clear' }),
  });

  const url = service.serviceDetails?.url || `https://${SERVICE_NAME}.onrender.com`;
  console.log(`
Готово. Дождитесь деплоя (~5–10 мин), затем проверьте:
  ${url}/api/health
`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
