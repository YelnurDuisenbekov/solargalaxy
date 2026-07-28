import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import crmRoutes from './routes/crm.js';
import warehouseRoutes from './routes/warehouse.js';
import erpRoutes from './routes/erp.js';
import financeRoutes from './routes/finance.js';
import portalRoutes from './routes/portal.js';
import integrationsRoutes from './routes/integrations.js';
import operationsRoutes from './routes/operations.js';
import publicRoutes from './routes/public.js';
import whatsappRoutes from './routes/whatsapp.js';
import proposalsRoutes from './routes/proposals.js';
import analyticsRoutes from './routes/analytics.js';
import { ensureReservationsSynced } from './lib/stockReservation.js';
import {
  apiRateLimiter,
  permissionsPolicyHeader,
  securityHeaders,
} from './lib/security.js';

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
  console.error('FATAL: JWT_SECRET must be set to a strong value in production');
  process.exit(1);
}

app.set('trust proxy', 1);

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(securityHeaders());
app.use(permissionsPolicyHeader);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Preview-деплои Vercel (без credentials wildcard *)
    if (/^https:\/\/[\w.-]+\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Base64-вложения проектов до ~15 МБ; общий потолок против DoS
app.use(express.json({ limit: '16mb' }));
app.use('/api', apiRateLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'solargalaxy-api' });
});

app.use('/api/public', publicRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/proposals', proposalsRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/erp', erpRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  const payload = { error: isProd ? 'Внутренняя ошибка сервера' : (err.message || 'Внутренняя ошибка сервера') };
  if (!isProd && err.stack) payload.stack = undefined; // never leak stack to client
  res.status(status >= 400 && status < 600 ? status : 500).json({ error: payload.error });
});

app.listen(PORT, () => {
  console.log(`SolarGalaxy API → http://localhost:${PORT}`);
  ensureReservationsSynced(true)
    .then(() => console.log('Stock reservations synced'))
    .catch((err) => console.error('Stock reservation sync failed:', err));
});
