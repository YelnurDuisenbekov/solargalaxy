import { sendQualifiedLeadReminders } from './qualifiedLeadReminder.js';
import { processQualifiedWhatsAppFollowUp } from './qualifiedWhatsAppFollowUp.js';

const TZ = process.env.REMINDER_TIMEZONE || 'Asia/Almaty';
const HOUR = Number(process.env.REMINDER_HOUR ?? 10);
const MINUTE = Number(process.env.REMINDER_MINUTE ?? 0);
const FOLLOWUP_INTERVAL_MS = Number(process.env.WHATSAPP_FOLLOWUP_INTERVAL_MS ?? 15 * 60 * 1000);

function getLocalTime(timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  return {
    hour: Number(parts.find((p) => p.type === 'hour').value),
    minute: Number(parts.find((p) => p.type === 'minute').value),
    dayKey: new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date()),
  };
}

export function startDailyScheduler() {
  let lastRunKey = '';
  let lastFollowUpAt = 0;

  const tick = async () => {
    const { hour, minute, dayKey } = getLocalTime(TZ);
    const runKey = `${dayKey}@${HOUR}:${MINUTE}`;

    if (hour === HOUR && minute === MINUTE && lastRunKey !== runKey) {
      lastRunKey = runKey;
      try {
        const result = await sendQualifiedLeadReminders({ timeZone: TZ });
        console.log(`[scheduler] напоминание менеджерам: ${result.sent} уведомлений, ${result.leads} лид(ов)`);
      } catch (e) {
        console.error('[scheduler] ошибка напоминания:', e);
        lastRunKey = '';
      }
    }

    const now = Date.now();
    if (now - lastFollowUpAt >= FOLLOWUP_INTERVAL_MS) {
      lastFollowUpAt = now;
      try {
        const wa = await processQualifiedWhatsAppFollowUp({ timeZone: TZ });
        if (wa.sent || wa.notified) {
          console.log(`[scheduler] авто WhatsApp: отправлено ${wa.sent}, уведомлений ${wa.notified}`);
        }
      } catch (e) {
        console.error('[scheduler] ошибка авто WhatsApp:', e);
      }
    }
  };

  setInterval(tick, 30_000);
  tick();
  console.log(`[scheduler] ежедневное напоминание в ${String(HOUR).padStart(2, '0')}:${String(MINUTE).padStart(2, '0')} (${TZ})`);
  console.log(`[scheduler] проверка авто WhatsApp каждые ${FOLLOWUP_INTERVAL_MS / 60000} мин`);
}
