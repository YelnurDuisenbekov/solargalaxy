import { sendWhatsAppText } from './whatsappApi.js';

function loginPageUrl() {
  const explicit = process.env.PUBLIC_SITE_URL?.trim();
  const fromList = (process.env.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const base =
    explicit ||
    fromList.find((u) => u.startsWith('https://')) ||
    fromList[0] ||
    'http://localhost:5173';
  return `${base.replace(/\/$/, '')}/login`;
}

function credentialsMessage({ fullName, phone, login, password }) {
  const loginHint = login && login !== phone ? login : phone;
  const sep = '__________';

  return [
    `Здравствуйте, ${fullName}!`,
    '',
    '☀️Добро пожаловать в Senergy!',
    '',
    'Вы очень важны для нас — мы ценим ваше доверие и будем рядом на каждом этапе.',
    sep,
    '',
    'Ваши данные для входа в личный кабинет:',
    `Логин: ${loginHint}`,
    `Пароль: ${password}`,
    sep,
    '',
    `Вход: ${loginPageUrl()}`,
    'Сохраните это сообщение. В кабинете — ваши заявки, проекты и расчёты.',
  ].join('\n');
}

/** Отправить логин и пароль клиенту в WhatsApp. */
export async function sendClientCredentials({ fullName, phone, login, password }) {
  if (!phone) {
    return { sent: false, channels: [], whatsappError: 'no_phone' };
  }

  const text = credentialsMessage({ fullName, phone, login, password });
  const wa = await sendWhatsAppText(phone, text);

  if (wa.sent) {
    return { sent: true, channels: ['whatsapp'], messageId: wa.messageId };
  }

  console.warn('[client-credentials] WhatsApp не отправлен:', wa.error || wa.reason, phone);
  return {
    sent: false,
    channels: [],
    whatsappError: wa.error || wa.reason || 'send_failed',
  };
}
