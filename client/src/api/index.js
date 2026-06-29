import { flashSuccess } from '../lib/flashBus';
import { getMutationFlashMessage } from '../lib/mutationFlash';

/** На Vercel задайте VITE_API_URL=https://ваш-api-хост (без /api в конце). Локально — proxy /api. */
const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API = API_ROOT ? `${API_ROOT}/api` : '/api';
const IS_REMOTE_API = Boolean(API_ROOT);
const IS_RENDER_PAID = import.meta.env.VITE_RENDER_PAID === 'true' || import.meta.env.VITE_RENDER_PAID === '1';
const FETCH_TIMEOUT_MS = IS_REMOTE_API ? (IS_RENDER_PAID ? 45_000 : 120_000) : 30_000;
const FETCH_RETRIES = IS_REMOTE_API ? (IS_RENDER_PAID ? 0 : 2) : 0;

/** Прогрев Render после «сна» — вызывается при загрузке публичного сайта. */
export function warmupApi() {
  if (!API_ROOT) return;
  fetch(`${API}/health`, { mode: 'cors' }).catch(() => {});
}

async function fetchWithRetry(path, options) {
  let lastError;
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${API}${path}`, { ...options, signal: controller.signal });
      window.clearTimeout(timer);
      return res;
    } catch (err) {
      window.clearTimeout(timer);
      lastError = err;
      if (attempt < FETCH_RETRIES) {
        await new Promise((resolve) => { window.setTimeout(resolve, 4000); });
      }
    }
  }
  throw lastError;
}

function networkErrorMessage() {
  if (!IS_REMOTE_API) return 'Сервер API недоступен. Запустите проект: npm run dev';
  if (IS_RENDER_PAID) return 'API Render недоступен. Проверьте https://solargalaxy-api.onrender.com/api/health';
  return 'Сервер просыпается (до 1–2 мин на бесплатном тарифе). Подождите и попробуйте снова.';
}

function getToken() {
  return localStorage.getItem('sg_token');
}

export class ApiError extends Error {
  constructor(message, fields) {
    super(message);
    this.name = 'ApiError';
    this.fields = fields || {};
  }
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetchWithRetry(path, { ...options, headers });
  } catch {
    throw new ApiError(networkErrorMessage());
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(
      IS_REMOTE_API
        ? networkErrorMessage()
        : 'Сервер API недоступен. Запустите backend: npm run dev',
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(data.error || `Ошибка ${res.status}`, data.fields);
    if (data.fallback) err.fallback = true;
    if (data.code) err.code = data.code;
    throw err;
  }

  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const flashMsg = getMutationFlashMessage(method, path, data);
    if (flashMsg) flashSuccess(flashMsg);
  }

  return data;
}

export const publicApi = {
  createLead: (body) => api('/public/leads', { method: 'POST', body: JSON.stringify(body) }),
};

export const authApi = {
  login: (login, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  registerClient: (body) => api('/auth/register-client', { method: 'POST', body: JSON.stringify(body) }),
};

export const usersApi = {
  list: (role) => api(`/users${role ? `?role=${role}` : ''}`),
  create: (body) => api('/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateMe: (body) => api('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  setPermissions: (id, permissions) => api(`/users/${id}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions }) }),
  delete: (id) => api(`/users/${id}`, { method: 'DELETE' }),
  toggle: (id) => api(`/users/${id}/toggle`, { method: 'PATCH' }),
  permissionList: () => api('/users/permissions'),
  me: () => api('/users/me'),
};

export const crmApi = {
  summary: () => api('/crm/summary'),
  leads: () => api('/crm/leads'),
  createLead: (body) => api('/crm/leads', { method: 'POST', body: JSON.stringify(body) }),
  updateLead: (id, body) => api(`/crm/leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  markLeadContact: (id) => api(`/crm/leads/${id}/contact`, { method: 'POST' }),
  markAutoWhatsAppSent: (id) => api(`/crm/leads/${id}/auto-whatsapp-sent`, { method: 'POST' }),
  sendLeadWhatsApp: (id, body) => api(`/crm/leads/${id}/whatsapp`, { method: 'POST', body: JSON.stringify(body || {}) }),
  claimLead: (id) => api(`/crm/leads/${id}/claim`, { method: 'POST' }),
  reassignLead: (id, assigneeId) => api(`/crm/leads/${id}/reassign`, { method: 'POST', body: JSON.stringify({ assigneeId }) }),
  convertLead: (id, body) => api(`/crm/leads/${id}/convert`, { method: 'POST', body: JSON.stringify(body || {}) }),
  getLeadProposal: (id) => api(`/crm/leads/${id}/proposal`),
  saveLeadProposal: (id, body) => api(`/crm/leads/${id}/proposal`, { method: 'PUT', body: JSON.stringify(body) }),
  recalcLeadProposal: (id) => api(`/crm/leads/${id}/proposal/recalc`, { method: 'POST' }),
  kitPreview: (systemType, capacityKw) => api(`/crm/kit-preview?systemType=${systemType}&capacityKw=${capacityKw}`),
  deals: () => api('/crm/deals'),
  deal: (id) => api(`/crm/deals/${id}`),
  createDeal: (body) => api('/crm/deals', { method: 'POST', body: JSON.stringify(body) }),
  updateDeal: (id, body) => api(`/crm/deals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateDealStatus: (id, status) => api(`/crm/deals/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  activities: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return api(`/crm/activities${q ? `?${q}` : ''}`);
  },
  createActivity: (body) => api('/crm/activities', { method: 'POST', body: JSON.stringify(body) }),
  updateActivity: (id, body) => api(`/crm/activities/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export async function downloadFile(path) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(`Ошибка ${res.status}`);
  const blob = await res.blob();
  return blob;
}

export const erpApi = {
  summary: () => api('/erp/summary'),
  projects: (opts) => api(`/erp/projects${opts?.issuable ? '?issuable=1' : ''}`),
  project: (id) => api(`/erp/projects/${id}`),
  createProject: (body) => api('/erp/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (id, body) => api(`/erp/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  reassignProject: (id, assigneeId) => api(`/erp/projects/${id}/reassign`, { method: 'POST', body: JSON.stringify({ assigneeId }) }),
  createFromDeal: (dealId) => api(`/erp/projects/from-deal/${dealId}`, { method: 'POST' }),
  addMaterial: (projectId, body) => api(`/erp/projects/${projectId}/materials`, { method: 'POST', body: JSON.stringify(body) }),
  updateMaterial: (projectId, materialId, body) => api(`/erp/projects/${projectId}/materials/${materialId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  approveMaterials: (projectId) => api(`/erp/projects/${projectId}/materials/approve`, { method: 'POST' }),
  returnMaterials: (projectId, note) => api(`/erp/projects/${projectId}/materials/return-to-manager`, { method: 'POST', body: JSON.stringify({ note }) }),
  saveMaterialsBulk: (projectId, body) => api(`/erp/projects/${projectId}/materials/bulk`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMaterial: (projectId, materialId) => api(`/erp/projects/${projectId}/materials/${materialId}`, { method: 'DELETE' }),
  issueMaterial: (projectId, body) => api(`/erp/projects/${projectId}/issue`, { method: 'POST', body: JSON.stringify(body) }),
  createTransferAct: (projectId, body) => api(`/erp/projects/${projectId}/transfer-acts`, { method: 'POST', body: JSON.stringify(body) }),
  transferActs: (projectId) => api(`/erp/projects/${projectId}/transfer-acts`),
  acceptTransferAct: (actId) => api(`/erp/transfer-acts/${actId}/accept`, { method: 'POST' }),
  writeOffMaterials: (projectId, note) => api(`/erp/projects/${projectId}/materials/write-off`, { method: 'POST', body: JSON.stringify({ note: note || '' }) }),
  openAuction: (projectId, body) => api(`/erp/projects/${projectId}/auction`, { method: 'POST', body: JSON.stringify(body || {}) }),
  auctionBrief: (projectId) => api(`/erp/projects/${projectId}/auction-brief`),
  acceptBid: (projectId, bidId) => api(`/erp/projects/${projectId}/accept-bid`, { method: 'POST', body: JSON.stringify({ bidId }) }),
  closeAuction: (projectId) => api(`/erp/projects/${projectId}/close-auction`, { method: 'POST' }),
  acceptLowestBid: (projectId) => api(`/erp/projects/${projectId}/accept-lowest-bid`, { method: 'POST' }),
  auctions: (status = 'open') => api(`/erp/auctions?status=${status}`),
  auctionResults: () => api('/erp/auctions/results'),
};

export const proposalsApi = {
  templates: (systemType) => api(`/proposals/templates${systemType ? `?systemType=${systemType}` : ''}`),
  createTemplate: (body) => api('/proposals/templates', { method: 'POST', body: JSON.stringify(body) }),
  updateTemplate: (id, body) => api(`/proposals/templates/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTemplate: (id) => api(`/proposals/templates/${id}`, { method: 'DELETE' }),
  preview: (systemType, capacityKw) => api(`/proposals/preview?systemType=${systemType}&capacityKw=${capacityKw}`),
};

export const operationsApi = {
  notifications: () => api('/operations/notifications'),
  allNotifications: () => api('/operations/notifications/all'),
  unreadCount: () => api('/operations/notifications/unread-count'),
  markRead: (id, scope) => api(`/operations/notifications/${id}/read${scope === 'all' ? '?scope=all' : ''}`, { method: 'PATCH' }),
  markAllRead: (scope) => api(`/operations/notifications/read-all${scope === 'all' ? '?scope=all' : ''}`, { method: 'PATCH' }),
  auctions: () => api('/operations/auctions'),
  auctionHistory: () => api('/operations/auctions/history'),
  myBids: () => api('/operations/my-bids'),
  submitBid: (body) => api('/operations/bids', { method: 'POST', body: JSON.stringify(body) }),
  projectBids: (projectId) => api(`/operations/auctions/${projectId}/bids`),
  downloadAuctionAttachment: (projectId, attachmentId) => downloadFile(`/operations/auctions/${projectId}/attachments/${attachmentId}`),
  downloadProjectAttachment: (projectId, attachmentId) => downloadFile(`/erp/projects/${projectId}/attachments/${attachmentId}`),
};

export const financeApi = {
  summary: () => api('/finance/summary'),
  invoices: () => api('/finance/invoices'),
  createInvoice: (body) => api('/finance/invoices', { method: 'POST', body: JSON.stringify(body) }),
  updateInvoice: (id, body) => api(`/finance/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const portalApi = {
  dashboard: () => api('/portal/dashboard'),
  project: (id) => api(`/portal/projects/${id}`),
  deal: (id) => api(`/portal/deals/${id}`),
  invoice: (id) => api(`/portal/invoices/${id}`),
  lead: (id) => api(`/portal/leads/${id}`),
};

export const warehouseApi = {
  products: () => api('/warehouse/products'),
  productReservations: (productId) => api(`/warehouse/products/${productId}/reservations`),
  createProduct: (body) => api('/warehouse/products', { method: 'POST', body: JSON.stringify(body) }),
  suppliers: () => api('/warehouse/suppliers'),
  createSupplier: (body) => api('/warehouse/suppliers', { method: 'POST', body: JSON.stringify(body) }),
  movements: () => api('/warehouse/movements'),
  createMovement: (body) => api('/warehouse/movements', { method: 'POST', body: JSON.stringify(body) }),
  updateStockBulk: (body) => api('/warehouse/stock/bulk', { method: 'PUT', body: JSON.stringify(body) }),
  stockAdjustments: (status) => api(`/warehouse/stock/adjustments${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  approveStockAdjustment: (id) => api(`/warehouse/stock/adjustments/${id}/approve`, { method: 'POST' }),
  rejectStockAdjustment: (id, body) => api(`/warehouse/stock/adjustments/${id}/reject`, { method: 'POST', body: JSON.stringify(body || {}) }),
  receipts: (supplierId) => api(`/warehouse/receipts${supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : ''}`),
  createReceipt: (body) => api('/warehouse/receipts', { method: 'POST', body: JSON.stringify(body) }),
  updateReceipt: (id, body) => api(`/warehouse/receipts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  summary: () => api('/warehouse/summary'),
  issuableProjects: () => api('/warehouse/issuable-projects'),
  issuableProject: (id) => api(`/warehouse/issuable-projects/${id}`),
  createProjectTransferAct: (projectId, body) => api(`/warehouse/issuable-projects/${projectId}/transfer-acts`, { method: 'POST', body: JSON.stringify(body) }),
  updatePricing: (body) => api('/warehouse/products/pricing', { method: 'PUT', body: JSON.stringify(body) }),
  transferActs: () => api('/warehouse/transfer-acts'),
  acceptedInventory: () => api('/warehouse/accepted-inventory'),
  writeOffs: (status) => api(`/warehouse/write-offs${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  approveWriteOffDirector: (id) => api(`/warehouse/write-offs/${id}/approve-director`, { method: 'POST' }),
  approveWriteOffAccountant: (id) => api(`/warehouse/write-offs/${id}/approve-accountant`, { method: 'POST' }),
  rejectWriteOff: (id, note) => api(`/warehouse/write-offs/${id}/reject`, { method: 'POST', body: JSON.stringify({ note: note || '' }) }),
  acceptTransferAct: (id) => api(`/warehouse/transfer-acts/${id}/accept`, { method: 'POST' }),
};

export const whatsappApi = {
  status: () => api('/whatsapp/status'),
  test: (body) => api('/whatsapp/test', { method: 'POST', body: JSON.stringify(body) }),
};

export const integrationsApi = {
  status: () => api('/integrations/status'),
  syncProducts: (body) => api('/integrations/sync/products', { method: 'POST', body: JSON.stringify(body || {}) }),
  syncStock: (body) => api('/integrations/sync/stock', { method: 'POST', body: JSON.stringify(body || {}) }),
  logs: () => api('/integrations/logs'),
};

export const analyticsApi = {
  summary: (days = 30) => api(`/analytics/summary?days=${days}`),
};
