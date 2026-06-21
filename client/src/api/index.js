const API = '/api';

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

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(data.error || `Ошибка ${res.status}`, data.fields);
    if (data.fallback) err.fallback = true;
    if (data.code) err.code = data.code;
    throw err;
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
  projects: () => api('/erp/projects'),
  project: (id) => api(`/erp/projects/${id}`),
  createProject: (body) => api('/erp/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (id, body) => api(`/erp/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createFromDeal: (dealId) => api(`/erp/projects/from-deal/${dealId}`, { method: 'POST' }),
  addMaterial: (projectId, body) => api(`/erp/projects/${projectId}/materials`, { method: 'POST', body: JSON.stringify(body) }),
  updateMaterial: (projectId, materialId, body) => api(`/erp/projects/${projectId}/materials/${materialId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMaterial: (projectId, materialId) => api(`/erp/projects/${projectId}/materials/${materialId}`, { method: 'DELETE' }),
  issueMaterial: (projectId, body) => api(`/erp/projects/${projectId}/issue`, { method: 'POST', body: JSON.stringify(body) }),
  openAuction: (projectId, body) => api(`/erp/projects/${projectId}/auction`, { method: 'POST', body: JSON.stringify(body || {}) }),
  auctionBrief: (projectId) => api(`/erp/projects/${projectId}/auction-brief`),
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
  unreadCount: () => api('/operations/notifications/unread-count'),
  markRead: (id) => api(`/operations/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => api('/operations/notifications/read-all', { method: 'PATCH' }),
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
  createProduct: (body) => api('/warehouse/products', { method: 'POST', body: JSON.stringify(body) }),
  movements: () => api('/warehouse/movements'),
  createMovement: (body) => api('/warehouse/movements', { method: 'POST', body: JSON.stringify(body) }),
  summary: () => api('/warehouse/summary'),
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
