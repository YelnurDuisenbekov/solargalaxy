import 'dotenv/config';
import { sendQualifiedLeadReminders } from '../src/lib/qualifiedLeadReminder.js';

const timeZone = process.env.REMINDER_TIMEZONE || 'Asia/Almaty';

sendQualifiedLeadReminders({ timeZone })
  .then((result) => {
    console.log(`Готово: ${result.sent} уведомлений для ${result.leads} лид(ов)`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
