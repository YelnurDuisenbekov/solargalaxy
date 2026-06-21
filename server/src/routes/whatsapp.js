import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authRequired, attachUser, requirePermission } from '../lib/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';
import {
  getWhatsAppPublicStatus,
  isWhatsAppConfigured,
  sendWhatsAppText,
  verifyWhatsAppConnection,
} from '../lib/whatsappApi.js';

const router = Router();

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post('/webhook', (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages;

    if (messages?.length) {
      for (const msg of messages) {
        const from = msg.from;
        const text = msg.text?.body || msg.type;
        console.log(`[whatsapp] входящее от ${from}: ${text}`);
      }
    }

    if (value?.statuses?.length) {
      for (const st of value.statuses) {
        console.log(`[whatsapp] статус ${st.id}: ${st.status}`);
      }
    }
  } catch (e) {
    console.error('[whatsapp] webhook parse error:', e);
  }

  res.sendStatus(200);
});

router.use(authRequired, attachUser);

router.get('/status', requirePermission(PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_VIEW_ALL, PERMISSIONS.ADMIN_FULL), async (_req, res) => {
  const publicStatus = getWhatsAppPublicStatus();
  if (!publicStatus.configured) {
    const hint = publicStatus.provider === 'green' || process.env.WHATSAPP_PROVIDER === 'green'
      ? 'Запустите npm run green:setup и укажите GREEN_API_ID_INSTANCE + GREEN_API_TOKEN'
      : 'Укажите WHATSAPP_TOKEN и WHATSAPP_PHONE_ID или переключитесь на Green API';
    return res.json({ ...publicStatus, ready: false, message: hint });
  }

  const verify = await verifyWhatsAppConnection();
  const okMsg = publicStatus.provider === 'green'
    ? 'Green API подключён — сообщения отправляются с вашего WhatsApp'
    : 'WhatsApp Cloud API подключён';

  res.json({
    ...publicStatus,
    ready: verify.ok,
    phone: verify.displayPhone || null,
    verifiedName: verify.verifiedName || null,
    qualityRating: verify.qualityRating || null,
    state: verify.state || null,
    error: verify.ok ? null : verify.error,
    message: verify.ok ? okMsg : `Ошибка: ${verify.error || verify.reason}`,
  });
});

router.post('/test', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({
    phone: z.string().min(10),
    text: z.string().min(1).optional(),
  });

  try {
    if (!isWhatsAppConfigured()) {
      return res.status(503).json({ error: 'WhatsApp API не настроен' });
    }

    const { phone, text } = schema.parse(req.body || {});
    const result = await sendWhatsAppText(
      phone,
      text || 'Тестовое сообщение SOLAR GALAXY — WhatsApp API работает.',
    );

    if (!result.sent) {
      return res.status(502).json({ error: result.error || result.reason, details: result.details });
    }

    res.json({ ok: true, messageId: result.messageId });
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/logs', requirePermission(PERMISSIONS.ADMIN_FULL), async (_req, res) => {
  res.json({ note: 'Логи входящих сообщений пишутся в консоль сервера' });
});

export default router;
