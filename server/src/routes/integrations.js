import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authRequired, requireRoles } from '../lib/auth.js';

const router = Router();
router.use(authRequired, requireRoles('ADMIN', 'EMPLOYEE'));

router.get('/status', (_req, res) => {
  res.json({
    connected: Boolean(process.env.ONEC_API_URL),
    apiUrl: process.env.ONEC_API_URL || null,
    message: process.env.ONEC_API_URL
      ? 'Конфигурация 1С задана — готово к разработке обмена'
      : 'Укажите ONEC_API_URL и ONEC_API_KEY в .env для подключения 1С',
  });
});

router.post('/sync/products', async (req, res) => {
  const log = await prisma.oneCSyncLog.create({
    data: {
      direction: 'FROM_1C',
      entity: 'products',
      status: 'PENDING',
      payload: JSON.stringify(req.body || {}),
      message: 'Заглушка: синхронизация товаров с 1С будет реализована',
    },
  });
  res.json({ ok: true, log, note: 'Endpoint для будущей интеграции с 1С: CommerceML / OData / HTTP-сервис' });
});

router.post('/sync/stock', async (req, res) => {
  const log = await prisma.oneCSyncLog.create({
    data: {
      direction: 'FROM_1C',
      entity: 'stock',
      status: 'PENDING',
      payload: JSON.stringify(req.body || {}),
      message: 'Заглушка: синхронизация остатков с 1С будет реализована',
    },
  });
  res.json({ ok: true, log });
});

router.get('/logs', async (_req, res) => {
  const logs = await prisma.oneCSyncLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(logs);
});

export default router;
