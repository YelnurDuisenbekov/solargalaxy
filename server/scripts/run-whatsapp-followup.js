import 'dotenv/config';
import { processQualifiedWhatsAppFollowUp } from '../src/lib/qualifiedWhatsAppFollowUp.js';

const timeZone = process.env.REMINDER_TIMEZONE || 'Asia/Almaty';

processQualifiedWhatsAppFollowUp({ timeZone })
  .then((result) => {
    console.log(`Проверено: ${result.checked}, WhatsApp API: ${result.sent}, уведомлений: ${result.notified}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
