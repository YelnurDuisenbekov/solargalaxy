export const CRM_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'EMPLOYEE'];
export const ERP_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'EMPLOYEE'];
export const WAREHOUSE_ROLES = ['ADMIN', 'DIRECTOR', 'WAREHOUSE'];
export const SUPPLY_ROLES = ['ADMIN', 'DIRECTOR', 'SUPPLY'];
export const FINANCE_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'EMPLOYEE', 'ACCOUNTANT'];
export const CONTRACTOR_ROLES = ['CONTRACTOR'];
export const STAFF_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'EMPLOYEE', 'WAREHOUSE', 'SUPPLY', 'ACCOUNTANT'];
export const USER_ADMIN_ROLES = ['ADMIN', 'DIRECTOR'];

export function hasRole(user, ...roles) {
  return roles.includes(user?.role);
}
