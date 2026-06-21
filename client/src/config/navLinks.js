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
      { to: '/app/profile', label: 'Профиль' },
    ],
  },
];

export const CLIENT_NAV = [
  { to: '/app/portal', label: 'Мой кабинет', end: true },
  { to: '/app/profile', label: 'Профиль' },
];
