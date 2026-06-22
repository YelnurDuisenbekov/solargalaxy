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
import { syncAllProjectReservations, ensureReservationsSynced } from './lib/stockReservation.js';

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^https:\/\/[\w.-]+\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());

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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`SolarGalaxy API → http://localhost:${PORT}`);
  ensureReservationsSynced(true)
    .then(() => console.log('Stock reservations synced'))
    .catch((err) => console.error('Stock reservation sync failed:', err));
});
