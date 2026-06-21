function phoneToWaDigits(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return digits;
  if (digits.length === 10) return `7${digits}`;
  return null;
}

export function getGreenApiConfig() {
  return {
    idInstance: process.env.GREEN_API_ID_INSTANCE?.trim(),
    apiToken: process.env.GREEN_API_TOKEN?.trim(),
    apiUrl: (process.env.GREEN_API_URL?.trim() || 'https://api.green-api.com').replace(/\/$/, ''),
  };
}

export function isGreenApiConfigured() {
  const { idInstance, apiToken } = getGreenApiConfig();
  return Boolean(idInstance && apiToken);
}

function instanceUrl(method) {
  const { idInstance, apiToken, apiUrl } = getGreenApiConfig();
  return `${apiUrl}/waInstance${idInstance}/${method}/${apiToken}`;
}

export function phoneToGreenChatId(phone) {
  const digits = phoneToWaDigits(phone);
  if (!digits) return null;
  return `${digits}@c.us`;
}

export async function verifyGreenApiConnection() {
  if (!isGreenApiConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  const res = await fetch(instanceUrl('getStateInstance'));
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      reason: 'auth_failed',
      error: data?.message || data?.error || res.statusText,
    };
  }

  const state = data.stateInstance;
  if (state !== 'authorized') {
    return {
      ok: false,
      reason: 'not_authorized',
      state,
      error: state === 'notAuthorized'
        ? 'WhatsApp не подключён — отсканируйте QR в личном кабинете Green API'
        : `Статус инстанса: ${state}`,
    };
  }

  let phone = null;
  try {
    const settingsRes = await fetch(instanceUrl('getSettings'));
    const settings = await settingsRes.json().catch(() => ({}));
    phone = settings.wid?.split('@')[0] || null;
    if (phone && !phone.startsWith('+')) {
      phone = `+${phone}`;
    }
  } catch {
    /* optional */
  }

  return {
    ok: true,
    state,
    displayPhone: phone,
    verifiedName: 'Green API',
  };
}

export async function sendGreenApiText(phone, text) {
  if (!isGreenApiConfigured()) return { sent: false, reason: 'not_configured' };

  const chatId = phoneToGreenChatId(phone);
  if (!chatId) return { sent: false, reason: 'invalid_phone' };

  const res = await fetch(instanceUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: text }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    return {
      sent: false,
      reason: 'api_error',
      error: data?.message || data?.error || res.statusText,
      details: data,
    };
  }

  return { sent: true, messageId: data.idMessage, via: 'green', details: data };
}

export function getGreenApiPublicStatus() {
  const cfg = getGreenApiConfig();
  return {
    provider: 'green',
    configured: isGreenApiConfigured(),
    instanceId: cfg.idInstance ? `…${cfg.idInstance.slice(-6)}` : null,
    consoleUrl: 'https://console.green-api.com',
    templates: null,
    webhookUrl: null,
    webhookConfigured: false,
  };
}
