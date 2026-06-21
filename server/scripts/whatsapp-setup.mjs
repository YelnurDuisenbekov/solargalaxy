/**
 * Настройка WhatsApp Cloud API для SOLAR GALAXY
 *
 * Использование:
 *   node scripts/whatsapp-setup.mjs
 *   node scripts/whatsapp-setup.mjs --token EAA... --phone-id 123456789
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '.env');
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const BUSINESS_PHONE = '+7 777 475 1332';

const TEMPLATES = [
  {
    name: 'sg_followup',
    language: 'ru',
    category: 'MARKETING',
    components: [{
      type: 'BODY',
      text: 'Здравствуйте, {{1}}!\n\nЭто {{2}} из SOLAR GALAXY.\n\nВы интересовались солнечной станцией — готов обсудить детали, ответить на вопросы и подготовить расчёт. Когда вам удобно созвониться?',
      example: { body_text: [['Айдар', 'Алмас']] },
    }],
  },
  {
    name: 'sg_initial',
    language: 'ru',
    category: 'MARKETING',
    components: [{
      type: 'BODY',
      text: 'Здравствуйте, {{1}}!\n\nМеня зовут {{2}}, менеджер по продажам SOLAR GALAXY.\n\nПо вашей заявке: город {{3}}, мощность {{4}}.\n\nГотов ответить на вопросы и подготовить расчёт. Когда вам удобно созвониться?',
      example: { body_text: [['Айдар', 'Алмас', 'Алматы', '10 кВт']] },
    }],
  },
];

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--token') out.token = args[i + 1];
    if (args[i] === '--phone-id') out.phoneId = args[i + 1];
    if (args[i] === '--waba-id') out.wabaId = args[i + 1];
  }
  return out;
}

async function graphGet(path, token) {
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function graphPost(path, token, body) {
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function verifyPhone(token, phoneId) {
  const { ok, data } = await graphGet(`/${phoneId}?fields=display_phone_number,verified_name,quality_rating`, token);
  if (!ok) throw new Error(data.error?.message || 'Не удалось проверить Phone ID');
  return data;
}

async function resolveWabaId(token, phoneId, wabaIdHint) {
  if (wabaIdHint) return wabaIdHint;

  const { ok, data } = await graphGet(`/${phoneId}?fields=whatsapp_business_account`, token);
  if (ok && data.whatsapp_business_account?.id) return data.whatsapp_business_account.id;

  const me = await graphGet('/me/businesses', token);
  if (me.ok && me.data.data?.[0]?.id) {
    const bizId = me.data.data[0].id;
    const waba = await graphGet(`/${bizId}?fields=owned_whatsapp_business_accounts`, token);
    const id = waba.data?.owned_whatsapp_business_accounts?.data?.[0]?.id;
    if (id) return id;
  }

  throw new Error('Не найден WhatsApp Business Account ID. Укажите --waba-id вручную из Meta → WhatsApp → API Setup');
}

async function listTemplates(token, wabaId) {
  const { ok, data } = await graphGet(`/${wabaId}/message_templates?limit=100`, token);
  if (!ok) return [];
  return data.data || [];
}

async function createTemplate(token, wabaId, tpl) {
  const existing = await listTemplates(token, wabaId);
  if (existing.some((t) => t.name === tpl.name && t.language === tpl.language)) {
    console.log(`  ✓ шаблон ${tpl.name} (${tpl.language}) уже есть`);
    return { skipped: true };
  }

  const { ok, data } = await graphPost(`/${wabaId}/message_templates`, token, tpl);
  if (!ok) {
    console.warn(`  ⚠ ${tpl.name}: ${data.error?.message || 'ошибка создания'}`);
    return { error: data.error?.message };
  }
  console.log(`  ✓ шаблон ${tpl.name} отправлен на модерацию (id: ${data.id || 'ok'})`);
  return { created: true };
}

function upsertEnv(vars) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';

  for (const [key, value] of Object.entries(vars)) {
    const line = `${key}="${value}"`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    content = re.test(content) ? content.replace(re, line) : `${content.trimEnd()}\n${line}\n`;
  }

  fs.writeFileSync(ENV_PATH, content.endsWith('\n') ? content : `${content}\n`);
  console.log(`\n✓ Записано в ${ENV_PATH}`);
}

function openMetaConsole() {
  const urls = [
    'https://developers.facebook.com/apps/',
    'https://business.facebook.com/wa/manage/message-templates/',
  ];
  console.log('\n── Откройте в браузере (Facebook уже открыт) ──');
  urls.forEach((u) => console.log(`  ${u}`));
  console.log(`
── В Meta Developer Console ──
1. Создайте приложение (тип: Business) или откройте существующее
2. Добавьте продукт «WhatsApp»
3. WhatsApp → API Setup:
   • Подключите номер ${BUSINESS_PHONE} (или подтвердите тестовый)
   • Скопируйте Phone number ID
   • Скопируйте временный Access token (или постоянный System User token)
4. WhatsApp → Configuration → Webhook (можно позже):
   • Callback URL: https://ВАШ-ДОМЕН/api/whatsapp/webhook
   • Verify token: solargalaxy-webhook-secret
`);
}

async function main() {
  console.log('SOLAR GALAXY — настройка WhatsApp Cloud API');
  console.log(`Бизнес-номер: ${BUSINESS_PHONE}\n`);

  const cli = parseArgs();
  openMetaConsole();

  let token = cli.token || process.env.WHATSAPP_TOKEN;
  let phoneId = cli.phoneId || process.env.WHATSAPP_PHONE_ID;

  if (!token) {
    token = await ask('\nВставьте Access Token из Meta (WhatsApp → API Setup): ');
  }
  if (!phoneId) {
    phoneId = await ask('Вставьте Phone number ID: ');
  }

  if (!token || !phoneId) {
    console.error('Token и Phone ID обязательны.');
    process.exit(1);
  }

  console.log('\nПроверка подключения…');
  const phone = await verifyPhone(token, phoneId);
  console.log(`  ✓ Номер: ${phone.display_phone_number || '—'}`);
  console.log(`  ✓ Имя: ${phone.verified_name || '—'}`);

  console.log('\nПоиск WhatsApp Business Account…');
  const wabaId = await resolveWabaId(token, phoneId, cli.wabaId);
  console.log(`  ✓ WABA ID: ${wabaId}`);

  console.log('\nСоздание шаблонов сообщений…');
  for (const tpl of TEMPLATES) {
    await createTemplate(token, wabaId, tpl);
  }

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'solargalaxy-webhook-secret';

  upsertEnv({
    WHATSAPP_TOKEN: token,
    WHATSAPP_PHONE_ID: phoneId,
    WHATSAPP_WABA_ID: wabaId,
    WHATSAPP_VERIFY_TOKEN: verifyToken,
    WHATSAPP_TEMPLATE_FOLLOWUP: 'sg_followup',
    WHATSAPP_TEMPLATE_INITIAL: 'sg_initial',
    WHATSAPP_TEMPLATE_LANGUAGE: 'ru',
    WHATSAPP_API_VERSION: API_VERSION,
    WHATSAPP_BUSINESS_PHONE: BUSINESS_PHONE,
    REMINDER_TIMEZONE: 'Asia/Almaty',
    REMINDER_HOUR: '10',
    REMINDER_MINUTE: '0',
  });

  console.log('\n── Тестовая отправка на ваш номер ──');
  const test = await ask(`Отправить тест на ${BUSINESS_PHONE}? (y/n): `);
  if (test.toLowerCase() === 'y') {
    const digits = '77774751332';
    const { ok, data } = await graphPost(`/${phoneId}/messages`, token, {
      messaging_product: 'whatsapp',
      to: digits,
      type: 'text',
      text: { body: 'SOLAR GALAXY: WhatsApp API подключён и работает! 🌞' },
    });
    if (ok) console.log('  ✓ Тестовое сообщение отправлено');
    else console.warn(`  ⚠ ${data.error?.message || 'не удалось отправить (возможно, нужен шаблон вне 24ч окна)'}`);
  }

  console.log(`
Готово! Перезапустите сервер: npm run dev
Проверка в CRM: Система → WhatsApp API
`);
}

main().catch((e) => {
  console.error('\nОшибка:', e.message);
  process.exit(1);
});
