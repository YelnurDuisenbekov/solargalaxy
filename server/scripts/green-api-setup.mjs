/**
 * Настройка Green API — без Facebook Developer
 * https://console.green-api.com
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '.env');
const BUSINESS_PHONE = '+7 777 475 1332';

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(q, (a) => { rl.close(); resolve(a.trim()); });
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--id') out.idInstance = args[i + 1];
    if (args[i] === '--token') out.apiToken = args[i + 1];
  }
  return out;
}

function upsertEnv(vars) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  for (const [key, value] of Object.entries(vars)) {
    const line = `${key}="${value}"`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    content = re.test(content) ? content.replace(re, line) : `${content.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(ENV_PATH, content.endsWith('\n') ? content : `${content}\n`);
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  SOLAR GALAXY — WhatsApp через Green API                 ║
║  Без Facebook Developer / Meta App                       ║
║  Номер: ${BUSINESS_PHONE}                          ║
╚══════════════════════════════════════════════════════════╝

ШАГ 1. Откройте https://console.green-api.com
       Зарегистрируйтесь (есть бесплатный тариф)

ШАГ 2. Создайте инстанс → отсканируйте QR в WhatsApp
       (Настройки → Связанные устройства → Привязка)
       на телефоне с номером ${BUSINESS_PHONE}

ШАГ 3. Скопируйте idInstance и apiTokenInstance с главной страницы инстанса
`);

  const cli = parseArgs();
  let idInstance = cli.idInstance || process.env.GREEN_API_ID_INSTANCE;
  let apiToken = cli.apiToken || process.env.GREEN_API_TOKEN;

  if (!idInstance) idInstance = await ask('\nidInstance: ');
  if (!apiToken) apiToken = await ask('apiTokenInstance: ');

  if (!idInstance || !apiToken) {
    console.error('idInstance и apiToken обязательны');
    process.exit(1);
  }

  const apiUrl = 'https://api.green-api.com';
  const stateRes = await fetch(`${apiUrl}/waInstance${idInstance}/getStateInstance/${apiToken}`);
  const state = await stateRes.json().catch(() => ({}));

  console.log(`\nСтатус инстанса: ${state.stateInstance || 'unknown'}`);

  if (state.stateInstance !== 'authorized') {
    console.log(`
⚠ WhatsApp ещё не авторизован.
  1. Откройте console.green-api.com → ваш инстанс
  2. Нажмите «Получить QR-код»
  3. Отсканируйте в WhatsApp на ${BUSINESS_PHONE}
  4. Запустите этот скрипт снова
`);
    upsertEnv({
      WHATSAPP_PROVIDER: 'green',
      GREEN_API_ID_INSTANCE: idInstance,
      GREEN_API_TOKEN: apiToken,
      GREEN_API_URL: apiUrl,
      WHATSAPP_BUSINESS_PHONE: BUSINESS_PHONE,
    });
    console.log('Ключи записаны в .env — после QR запустите снова для теста.');
    process.exit(0);
  }

  upsertEnv({
    WHATSAPP_PROVIDER: 'green',
    GREEN_API_ID_INSTANCE: idInstance,
    GREEN_API_TOKEN: apiToken,
    GREEN_API_URL: apiUrl,
    WHATSAPP_BUSINESS_PHONE: BUSINESS_PHONE,
    REMINDER_TIMEZONE: 'Asia/Almaty',
    REMINDER_HOUR: '10',
    REMINDER_MINUTE: '0',
  });

  console.log('✓ .env обновлён (WHATSAPP_PROVIDER=green)');

  const test = await ask(`\nОтправить тест на ${BUSINESS_PHONE}? (y/n): `);
  if (test.toLowerCase() === 'y') {
    const chatId = '77774751332@c.us';
    const sendRes = await fetch(`${apiUrl}/waInstance${idInstance}/sendMessage/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'SOLAR GALAXY: Green API подключён! CRM может отправлять сообщения автоматически. 🌞',
      }),
    });
    const sendData = await sendRes.json().catch(() => ({}));
    if (sendData.idMessage) {
      console.log(`✓ Тест отправлен, id: ${sendData.idMessage}`);
    } else {
      console.warn('⚠ Тест не отправлен:', sendData);
    }
  }

  console.log('\nГотово! Перезапустите npm run dev → Система → WhatsApp API\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
