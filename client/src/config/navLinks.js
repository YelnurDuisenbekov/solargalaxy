/** Группы навигации личного кабинета */
export const APP_NAV_GROUPS = [
  {
    id: 'crm',
    label: 'CRM',
    hint: 'Продажи',
    links: [
      { to: '/app', label: 'Обзор', end: true },
      { to: '/app/crm', label: 'Лиды' },
      { to: '/app/proposals', label: 'КП' },
    ],
  },
  {
    id: 'erp',
    label: 'ERP',
    hint: 'Реализация',
    links: [
      { to: '/app/projects', label: 'Проекты' },
      { to: '/app/auctions', label: 'Торги' },
      { to: '/app/warehouse', label: 'Склад' },
      { to: '/app/pricing', label: 'Ценообразование' },
      { to: '/app/supply', label: 'Снабжение' },
      { to: '/app/finance', label: 'Финансы' },
    ],
  },
  {
    id: 'system',
    label: 'Система',
    links: [
      { to: '/app/users', label: 'Пользователи' },
      { to: '/app/whatsapp', label: 'WhatsApp API' },
      { to: '/app/analytics', label: 'Аналитика' },
      { to: '/app/constructor', label: 'Конструктор' },
      { to: '/app/profile', label: 'Профиль' },
    ],
  },
];

export const WAREHOUSE_NAV_GROUPS = [
  {
    id: 'warehouse',
    label: 'Склад',
    hint: 'Учёт',
    links: [
      { to: '/app', label: 'Обзор', end: true },
      { to: '/app/warehouse', label: 'Склад' },
    ],
  },
  {
    id: 'system',
    label: 'Система',
    links: [
      { to: '/app/profile', label: 'Профиль' },
    ],
  },
];

export const CLIENT_NAV = [
  { to: '/app/portal', label: 'Мой кабинет', end: true },
  { to: '/app/profile', label: 'Профиль' },
];

/** Навигация по роли и правам */
export function getNavGroupsForUser({ user, hasPerm, isAdmin }) {
  if (user?.role === 'WAREHOUSE' && !isAdmin) {
    return WAREHOUSE_NAV_GROUPS;
  }

  if (user?.role === 'SUPPLY' && !isAdmin && !hasPerm('crm.view')) {
    return [
      { id: 'supply', label: 'Снабжение', links: [
        { to: '/app', label: 'Обзор', end: true },
        { to: '/app/supply', label: 'Уведомления' },
      ]},
      { id: 'system', label: 'Система', links: [{ to: '/app/profile', label: 'Профиль' }] },
    ];
  }

  if (user?.role === 'ACCOUNTANT' && !isAdmin) {
    return [
      { id: 'finance', label: 'Финансы', links: [
        { to: '/app', label: 'Обзор', end: true },
        { to: '/app/finance', label: 'Счета' },
        { to: '/app/warehouse', label: 'Склад', perm: 'warehouse.view' },
      ].filter((l) => !l.perm || hasPerm(l.perm)) },
      { id: 'system', label: 'Система', links: [{ to: '/app/profile', label: 'Профиль' }] },
    ];
  }

  return APP_NAV_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => {
      if (link.to === '/app/users') return hasPerm('users.view');
      if (link.to === '/app/whatsapp') return isAdmin || hasPerm('admin.full');
      if (link.to === '/app/analytics') return isAdmin || hasPerm('admin.full');
      if (link.to === '/app/constructor') return isAdmin || hasPerm('admin.full');
      if (link.to === '/app/crm' || link.to === '/app/proposals') {
        return hasPerm('crm.view') || hasPerm('crm.view_all');
      }
      if (link.to === '/app/projects' || link.to === '/app/auctions') {
        return hasPerm('erp.view') || hasPerm('erp.view_all');
      }
      if (link.to === '/app/warehouse') {
        return hasPerm('warehouse.view') || hasPerm('warehouse.issue');
      }
      if (link.to === '/app/pricing') return hasPerm('pricing.edit');
      if (link.to === '/app/supply') return hasPerm('supply.view');
      if (link.to === '/app/finance') return hasPerm('finance.view');
      return true;
    }),
  })).filter((group) => group.links.length > 0);
}

/** Маршруты, недоступные чистому завскладу */
export const WAREHOUSE_FORBIDDEN_PATHS = [
  '/app/crm',
  '/app/proposals',
  '/app/projects',
  '/app/auctions',
  '/app/auction-results',
  '/app/supply',
  '/app/finance',
  '/app/pricing',
  '/app/users',
  '/app/whatsapp',
  '/app/analytics',
  '/app/constructor',
];

export function isWarehouseStaff(user, isAdmin) {
  return user?.role === 'WAREHOUSE' && !isAdmin;
}
