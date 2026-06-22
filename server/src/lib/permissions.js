export const PERMISSIONS = {
  ADMIN_FULL: 'admin.full',
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  USERS_PERMISSIONS: 'users.permissions',
  CRM_VIEW: 'crm.view',
  CRM_VIEW_ALL: 'crm.view_all',
  CRM_EDIT: 'crm.edit',
  ERP_VIEW: 'erp.view',
  ERP_VIEW_ALL: 'erp.view_all',
  ERP_EDIT: 'erp.edit',
  FINANCE_VIEW: 'finance.view',
  FINANCE_EDIT: 'finance.edit',
  WAREHOUSE_VIEW: 'warehouse.view',
  WAREHOUSE_ISSUE: 'warehouse.issue',
  WAREHOUSE_EDIT: 'warehouse.edit',
  PRICING_EDIT: 'pricing.edit',
  SUPPLY_VIEW: 'supply.view',
  PROFILE_EDIT: 'profile.edit',
};

/** Просмотр всех разделов — у каждой роли сотрудника */
const VIEW_ALL_SECTIONS = [
  PERMISSIONS.CRM_VIEW,
  PERMISSIONS.ERP_VIEW,
  PERMISSIONS.WAREHOUSE_VIEW,
  PERMISSIONS.SUPPLY_VIEW,
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.PROFILE_EDIT,
];

export const PERMISSION_LABELS = {
  'admin.full': 'Полный доступ (админ)',
  'users.view': 'Просмотр пользователей',
  'users.create': 'Создание пользователей',
  'users.edit': 'Редактирование пользователей',
  'users.delete': 'Удаление пользователей',
  'users.permissions': 'Управление разрешениями',
  'crm.view': 'CRM — свои данные',
  'crm.view_all': 'CRM — все данные',
  'crm.edit': 'CRM — редактирование',
  'erp.view': 'ERP — свои проекты',
  'erp.view_all': 'ERP — все проекты',
  'erp.edit': 'ERP — редактирование',
  'finance.view': 'Финансы — просмотр',
  'finance.edit': 'Финансы — редактирование',
  'warehouse.view': 'Склад — просмотр',
  'warehouse.issue': 'Склад — выдача',
  'warehouse.edit': 'Склад — редактирование',
  'pricing.edit': 'Ценообразование',
  'supply.view': 'Снабжение — уведомления',
  'profile.edit': 'Редактирование профиля',
};

const ROLE_DEFAULTS = {
  ADMIN: [PERMISSIONS.ADMIN_FULL, ...VIEW_ALL_SECTIONS, PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_DELETE, PERMISSIONS.USERS_PERMISSIONS],
  DIRECTOR: [
    ...VIEW_ALL_SECTIONS,
    PERMISSIONS.CRM_VIEW_ALL, PERMISSIONS.ERP_VIEW_ALL,
    PERMISSIONS.CRM_EDIT, PERMISSIONS.ERP_EDIT,
    PERMISSIONS.FINANCE_EDIT, PERMISSIONS.WAREHOUSE_ISSUE,
    PERMISSIONS.PRICING_EDIT,
    PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_EDIT,
  ],
  MANAGER: [...VIEW_ALL_SECTIONS, PERMISSIONS.CRM_EDIT, PERMISSIONS.ERP_EDIT],
  EMPLOYEE: [...VIEW_ALL_SECTIONS, PERMISSIONS.CRM_EDIT, PERMISSIONS.ERP_EDIT],
  WAREHOUSE: [
    PERMISSIONS.WAREHOUSE_VIEW,
    PERMISSIONS.WAREHOUSE_ISSUE,
    PERMISSIONS.WAREHOUSE_EDIT,
    PERMISSIONS.PROFILE_EDIT,
  ],
  SUPPLY: [...VIEW_ALL_SECTIONS],
  ACCOUNTANT: [...VIEW_ALL_SECTIONS, PERMISSIONS.FINANCE_EDIT],
  CONTRACTOR: [...VIEW_ALL_SECTIONS],
  CLIENT: [PERMISSIONS.PROFILE_EDIT],
};

export function resolvePermissions(user) {
  const set = new Set(ROLE_DEFAULTS[user.role] || [PERMISSIONS.PROFILE_EDIT]);
  for (const p of user.permissions || []) set.add(p.key);
  return set;
}

export function hasPermission(permissions, key) {
  return permissions.has(PERMISSIONS.ADMIN_FULL) || permissions.has(key);
}

export function hasAnyPermission(permissions, ...keys) {
  if (permissions.has(PERMISSIONS.ADMIN_FULL)) return true;
  return keys.some((k) => permissions.has(k));
}

export function canViewAllCrm(permissions) {
  return hasAnyPermission(permissions, PERMISSIONS.CRM_VIEW_ALL);
}

export function canViewAllErp(permissions) {
  return hasAnyPermission(permissions, PERMISSIONS.ERP_VIEW_ALL);
}

export function listAssignablePermissions() {
  return Object.entries(PERMISSION_LABELS)
    .filter(([key]) => key !== PERMISSIONS.ADMIN_FULL)
    .map(([key, label]) => ({ key, label }));
}
