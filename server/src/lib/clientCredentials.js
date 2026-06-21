import { sendWhatsAppText } from './whatsappApi.js';

function credentialsMessage({ fullName, phone, password }) {
  const site = process.env.PUBLIC_SITE_URL?.trim() || 'https://solargalaxy.kz';

  return [
    `Здравствуйте, ${fullName}!`,
    '',
    'Вы зарегистрированы в личном кабинете Solar Galaxy.',
    '',
    `Телефон для входа: ${phone}`,
    `Пароль: ${password}`,
    '',
    `Вход: ${site}/login`,
    '',
    'Сохраните эти данные. В кабинете вы увидите свои заявки, проекты и расчёты.',
  ].join('\n');
}

/** Отправить телефон и пароль клиенту в WhatsApp. */
export async function sendClientCredentials({ fullName, phone, password }) {
  const text = credentialsMessage({ fullName, phone, password });
  const channels = [];

  if (phone) {
    const wa = await sendWhatsAppText(phone, text);
    if (wa.sent) channels.push('whatsapp');
  }

  return {
    sent: channels.length > 0,
    channels,
  };
}
