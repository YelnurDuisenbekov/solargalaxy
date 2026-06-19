const API = '/api';

function getToken() {
  return localStorage.getItem('sg_token');
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

export const publicApi = {
  createLead: (body) => api('/public/leads', { method: 'POST', body: JSON.stringify(body) }),
};

export const authApi = {
  login: (email, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  registerClient: (body) => api('/auth/register-client', { method: 'POST', body: JSON.stringify(body) }),
};

export const usersApi = {
  list: (role) => api(`/users${role ? `?role=${role}` : ''}`),
  create: (body) => api('/users', { method: 'POST', body: JSON.stringify(body) }),
  toggle: (id) => api(`/users/${id}/toggle`, { method: 'PATCH' }),
  me: () => api('/users/me'),
};

export const crmApi = {
  leads: () => api('/crm/leads'),
  createLead: (body) => api('/crm/leads', { method: 'POST', body: JSON.stringify(body) }),
  deals: () => api('/crm/deals'),
  createDeal: (body) => api('/crm/deals', { method: 'POST', body: JSON.stringify(body) }),
  updateDealStatus: (id, status) => api(`/crm/deals/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const warehouseApi = {
  products: () => api('/warehouse/products'),
  createProduct: (body) => api('/warehouse/products', { method: 'POST', body: JSON.stringify(body) }),
  movements: () => api('/warehouse/movements'),
  createMovement: (body) => api('/warehouse/movements', { method: 'POST', body: JSON.stringify(body) }),
  summary: () => api('/warehouse/summary'),
};
