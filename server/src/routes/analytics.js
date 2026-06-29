import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authRequired, attachUser, requirePermission } from '../lib/auth.js';

const router = Router();

router.use(authRequired, attachUser, requirePermission('admin.full'));

function parseDays(raw) {
  const days = Number(raw);
  if (!Number.isFinite(days) || days < 1) return 30;
  return Math.min(Math.floor(days), 365);
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildDailySeries(items, getDate, getSessionId) {
  const byDay = new Map();
  for (const item of items) {
    const key = dayKey(getDate(item));
    if (!byDay.has(key)) {
      byDay.set(key, { date: key, views: 0, visitors: new Set() });
    }
    const row = byDay.get(key);
    row.views += 1;
    const sid = getSessionId(item);
    if (sid) row.visitors.add(sid);
  }
  return [...byDay.values()]
    .map((row) => ({ date: row.date, views: row.views, visitors: row.visitors.size }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

router.get('/summary', async (req, res) => {
  const days = parseDays(req.query.days);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [
    pageViews,
    formEvents,
    leads,
    leadsBySource,
    leadsByStatus,
  ] = await Promise.all([
    prisma.pageView.findMany({
      where: { createdAt: { gte: since } },
      select: { path: true, sessionId: true, createdAt: true },
    }),
    prisma.formEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { formId: true, event: true, sessionId: true, createdAt: true },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, source: true, status: true, createdAt: true },
    }),
    prisma.lead.groupBy({
      by: ['source'],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
  ]);

  const visitorSessions = new Set(
    pageViews.map((v) => v.sessionId).filter(Boolean),
  );

  const viewsByPath = {};
  for (const view of pageViews) {
    viewsByPath[view.path] = (viewsByPath[view.path] || 0) + 1;
  }

  const formStats = {};
  for (const ev of formEvents) {
    if (!formStats[ev.formId]) {
      formStats[ev.formId] = { view: 0, start: 0, submit: 0, error: 0 };
    }
    if (formStats[ev.formId][ev.event] != null) {
      formStats[ev.formId][ev.event] += 1;
    }
  }

  const siteLeads = leads.filter((l) => l.source === 'Сайт');
  const formViews = Object.values(formStats).reduce((sum, f) => sum + f.view, 0);
  const formStarts = Object.values(formStats).reduce((sum, f) => sum + f.start, 0);
  const formSubmits = Object.values(formStats).reduce((sum, f) => sum + f.submit, 0);

  const visitors = visitorSessions.size;
  const conversionFromVisitors = visitors > 0
    ? Math.round((siteLeads.length / visitors) * 1000) / 10
    : 0;
  const conversionFromFormViews = formViews > 0
    ? Math.round((siteLeads.length / formViews) * 1000) / 10
    : 0;

  res.json({
    period: { days, since: since.toISOString() },
    totals: {
      visitors,
      pageViews: pageViews.length,
      formViews,
      formStarts,
      formSubmits,
      leads: leads.length,
      siteLeads: siteLeads.length,
      conversionFromVisitors,
      conversionFromFormViews,
    },
    funnel: [
      { step: 'Посетители', count: visitors },
      { step: 'Просмотр формы', count: formViews },
      { step: 'Начали заполнять', count: formStarts },
      { step: 'Отправили форму', count: formSubmits },
      { step: 'Заявки в CRM', count: siteLeads.length },
    ],
    daily: buildDailySeries(
      pageViews,
      (v) => v.createdAt,
      (v) => v.sessionId,
    ),
    viewsByPath: Object.entries(viewsByPath)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count),
    forms: Object.entries(formStats)
      .map(([formId, stats]) => ({ formId, ...stats }))
      .sort((a, b) => b.view - a.view),
    leadsBySource: leadsBySource.map((row) => ({
      source: row.source,
      count: row._count,
    })),
    leadsByStatus: leadsByStatus.map((row) => ({
      status: row.status,
      count: row._count,
    })),
    recentLeads: leads
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10)
      .map((l) => ({
        id: l.id,
        source: l.source,
        status: l.status,
        createdAt: l.createdAt,
      })),
  });
});

export default router;
