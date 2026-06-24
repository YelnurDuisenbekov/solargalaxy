import { OBJECT_TYPE, SYSTEM_TYPE } from './crmConstants.js';
import {
  getGreenApiPublicStatus,
  isGreenApiConfigured,
  sendGreenApiText,
  verifyGreenApiConnection,
} from './greenApi.js';

export function phoneToWaDigits(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return digits;
  if (digits.length === 10) return `7${digits}`;
  return null;
}

export function getWhatsAppProvider() {
  const p = process.env.WHATSAPP_PROVIDER?.trim()?.toLowerCase();
  if (p === 'meta' || p === 'green') return p;
  if (isGreenApiConfigured()) return 'green';
  return 'meta';
}

export function getWhatsAppConfig() {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_ID?.trim();
  return {
    provider: getWhatsAppProvider(),
    token,
    phoneId,
    apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN?.trim(),
    templateInitial: process.env.WHATSAPP_TEMPLATE_INITIAL?.trim(),
    templateFollowup: process.env.WHATSAPP_TEMPLATE_FOLLOWUP?.trim(),
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'ru',
    publicWebhookUrl: process.env.WHATSAPP_WEBHOOK_PUBLIC_URL?.trim(),
    businessPhone: process.env.WHATSAPP_BUSINESS_PHONE?.trim(),
  };
}

export function isWhatsAppConfigured() {
  if (getWhatsAppProvider() === 'green') return isGreenApiConfigured();
  const { token, phoneId } = getWhatsAppConfig();
  return Boolean(token && phoneId);
}

function systemTypeLabel(systemType) {
  return SYSTEM_TYPE[systemType] || systemType || '';
}

export function buildClientMessage(lead, managerName) {
  const firstName = lead.fullName.trim().split(/\s+/)[0];
  const lines = [];
  if (lead.city) lines.push(`🏘️ Город: ${lead.city}`);
  if (lead.objectType) lines.push(`📄 Тип объекта: ${OBJECT_TYPE[lead.objectType] || lead.objectType}`);
  if (lead.systemType) lines.push(`🪫 Тип системы: ${systemTypeLabel(lead.systemType)}`);
  if (lead.capacityKw) lines.push(`⚡ Мощность: ${lead.capacityKw} кВт`);
  if (lead.notes) lines.push(`💬 Комментарий: ${lead.notes}`);

  return [
    `Здравствуйте, ${firstName}!`,
    '',
    `Меня зовут ${managerName}, менеджер по продажам SOLAR GALAXY.`,
    '',
    'По вашей заявке:',
    ...lines,
    '',
    'Готов ответить на ваши вопросы и подготовить расчёт. Когда вам удобно созвониться?',
  ].join('\n');
}

export function buildQualifiedFollowUpMessage(lead, managerName) {
  const firstName = lead.fullName.trim().split(/\s+/)[0];
  return [
    `Здравствуйте, ${firstName}!`,
    '',
    `Это ${managerName}, менеджер по продажам SOLAR GALAXY.`,
    '',
    'Вы интересовались солнечной станцией — готов обсудить детали, ответить на вопросы и подготовить расчёт.',
    'Когда вам удобно созвониться?',
  ].join('\n');
}

async function callGraphApi(payload) {
  const { token, phoneId, apiVersion } = getWhatsAppConfig();
  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    const code = data?.error?.code;
    return { sent: false, reason: 'api_error', error: msg, code, details: data?.error };
  }

  return { sent: true, messageId: data.messages?.[0]?.id, details: data };
}

export async function sendWhatsAppText(phone, text) {
  if (!isWhatsAppConfigured()) return { sent: false, reason: 'not_configured' };

  if (getWhatsAppProvider() === 'green') {
    return sendGreenApiText(phone, text);
  }

  const to = phoneToWaDigits(phone);
  if (!to) return { sent: false, reason: 'invalid_phone' };

  return callGraphApi({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  });
}

export async function sendWhatsAppTemplate(phone, templateName, languageCode, bodyParams = []) {
  if (getWhatsAppProvider() === 'green') {
    return { sent: false, reason: 'no_template' };
  }

  if (!isWhatsAppConfigured()) return { sent: false, reason: 'not_configured' };
  if (!templateName) return { sent: false, reason: 'no_template' };

  const to = phoneToWaDigits(phone);
  if (!to) return { sent: false, reason: 'invalid_phone' };

  const components = bodyParams.length
    ? [{
      type: 'body',
      parameters: bodyParams.map((t) => ({ type: 'text', text: String(t) })),
    }]
    : undefined;

  return callGraphApi({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  });
}

function templateParamsForKind(kind, lead, managerName) {
  const firstName = lead.fullName.trim().split(/\s+/)[0];
  if (kind === 'followup') return [firstName, managerName];
  const city = lead.city || '—';
  const kw = lead.capacityKw ? `${lead.capacityKw} кВт` : '—';
  return [firstName, managerName, city, kw];
}

export async function sendLeadWhatsAppMessage(lead, { kind = 'initial', managerName } = {}) {
  const name = managerName || lead.assignee?.fullName || 'Менеджер Solar Galaxy';
  const cfg = getWhatsAppConfig();
  const text = kind === 'followup'
    ? buildQualifiedFollowUpMessage(lead, name)
    : buildClientMessage(lead, name);

  if (getWhatsAppProvider() === 'green') {
    const result = await sendGreenApiText(lead.phone, text);
    return { ...result, via: 'green', kind, preview: text };
  }

  const templateName = kind === 'followup' ? cfg.templateFollowup : cfg.templateInitial;

  if (kind === 'followup' && templateName) {
    const result = await sendWhatsAppTemplate(
      lead.phone,
      templateName,
      cfg.templateLanguage,
      templateParamsForKind('followup', lead, name),
    );
    if (result.sent) return { ...result, via: 'template', kind };
    if (result.code !== 131047) return result;
  }

  if (templateName && kind === 'initial') {
    const result = await sendWhatsAppTemplate(
      lead.phone,
      templateName,
      cfg.templateLanguage,
      templateParamsForKind('initial', lead, name),
    );
    if (result.sent) return { ...result, via: 'template', kind };
  }

  const textResult = await sendWhatsAppText(lead.phone, text);
  return { ...textResult, via: 'text', kind, preview: text };
}

export async function verifyWhatsAppConnection() {
  if (!isWhatsAppConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  if (getWhatsAppProvider() === 'green') {
    return verifyGreenApiConnection();
  }

  const { token, phoneId, apiVersion } = getWhatsAppConfig();
  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      reason: 'auth_failed',
      error: data?.error?.message || res.statusText,
    };
  }

  return {
    ok: true,
    displayPhone: data.display_phone_number,
    verifiedName: data.verified_name,
    qualityRating: data.quality_rating,
  };
}

export function getWhatsAppPublicStatus() {
  const cfg = getWhatsAppConfig();
  const provider = getWhatsAppProvider();

  if (provider === 'green') {
    const green = getGreenApiPublicStatus();
    return {
      ...green,
      provider: 'green',
      providerLabel: 'Green API (без Facebook)',
      businessPhone: cfg.businessPhone || null,
    };
  }

  const configured = Boolean(cfg.token && cfg.phoneId);
  return {
    provider: 'meta',
    providerLabel: 'Meta Cloud API',
    configured,
    businessPhone: cfg.businessPhone || null,
    phoneId: cfg.phoneId ? `…${cfg.phoneId.slice(-6)}` : null,
    templates: {
      initial: cfg.templateInitial || null,
      followup: cfg.templateFollowup || null,
      language: cfg.templateLanguage,
    },
    webhookConfigured: Boolean(cfg.verifyToken),
    webhookUrl: cfg.publicWebhookUrl || null,
  };
}
