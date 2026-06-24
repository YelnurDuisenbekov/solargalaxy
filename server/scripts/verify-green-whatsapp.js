/**
 * Проверка Green API + тестовое сообщение (читает ключи из .env).
 * npm run green:verify
 */
import 'dotenv/config';
import { sendGreenApiText, verifyGreenApiConnection } from '../src/lib/greenApi.js';

const phone = process.env.WHATSAPP_BUSINESS_PHONE?.trim() || '+7 777 475 1332';

const verify = await verifyGreenApiConnection();
console.log('Статус:', verify.ok ? 'OK' : verify.reason || verify.error);
if (verify.state) console.log('Инстанс:', verify.state);
if (verify.displayPhone) console.log('WhatsApp:', verify.displayPhone);

if (!verify.ok) {
  console.error('\n✗', verify.error || verify.reason);
  if (verify.reason === 'invalid_token') {
    console.error('  1. console.green-api.com → Instance 7107659723');
    console.error('  2. Скопируйте apiTokenInstance заново');
    console.error('  3. npm run green:setup — вставьте id и токен');
  } else {
    console.error('  Подключите QR в console.green-api.com и перезапустите.');
  }
  process.exitCode = 1;
  process.exit();
}

const result = await sendGreenApiText(
  phone,
  'SENERGY: WhatsApp API подключён. CRM может отправлять сообщения клиентам автоматически.',
);

if (result.sent) {
  console.log('\n✓ Тестовое сообщение отправлено на', phone);
  console.log('  messageId:', result.messageId);
} else {
  console.error('\n✗ Не удалось отправить:', result.error || result.reason);
  process.exitCode = 1;
  process.exit();
}
