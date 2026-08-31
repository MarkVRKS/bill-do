// In Electron standalone mode, use local server on port 3456
const isElectron = !!(window as any).electronAPI?.isElectron;
const API_BASE = import.meta.env.VITE_API_URL || (isElectron ? 'http://127.0.0.1:3456' : 'http://localhost:3000');

interface ApiOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
}

async function request<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  register: (email: string, password: string) =>
    request('/api/auth/register', { method: 'POST', body: { email, password } }),

  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; onboardingDone: boolean } }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  logout: () => request('/api/auth/logout', { method: 'POST' }),

  me: () => request<{ user: { id: string; email: string; emailVerified: boolean; onboardingDone: boolean } }>('/api/auth/me'),

  forgotPassword: (email: string) =>
    request('/api/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (token: string, password: string) =>
    request('/api/auth/reset-password', { method: 'POST', body: { token, password } }),

  onboardingDone: () => request('/api/auth/onboarding-done', { method: 'POST' }),

  // Organizations
  getOrganizations: () => request<{ organizations: any[] }>('/api/organizations'),
  getActiveOrganization: () => request<{ organization: any }>('/api/organizations/active'),
  createOrganization: (data: any) =>
    request('/api/organizations', { method: 'POST', body: data }),
  updateOrganization: (id: string, data: any) =>
    request(`/api/organizations/${id}`, { method: 'PUT', body: data }),
  switchOrganization: (organizationId: string) =>
    request('/api/organizations/switch', { method: 'POST', body: { organizationId } }),
  deleteOrganization: (id: string) =>
    request(`/api/organizations/${id}`, { method: 'DELETE' }),

  // Counterparties
  getCounterparties: () => request<{ counterparties: any[] }>('/api/counterparties'),
  createCounterparty: (data: any) =>
    request('/api/counterparties', { method: 'POST', body: data }),
  updateCounterparty: (id: string, data: any) =>
    request(`/api/counterparties/${id}`, { method: 'PUT', body: data }),
  deleteCounterparty: (id: string) =>
    request(`/api/counterparties/${id}`, { method: 'DELETE' }),

  // Invoices
  getInvoices: (params?: Record<string, string>) =>
    request<{ invoices: any[] }>('/api/invoices', { params }),
  getInvoice: (id: string) =>
    request<{ invoice: any }>(`/api/invoices/${id}`),
  createInvoice: (data: any) =>
    request('/api/invoices', { method: 'POST', body: data }),
  updateInvoice: (id: string, data: any) =>
    request(`/api/invoices/${id}`, { method: 'PUT', body: data }),
  updateInvoiceStatus: (id: string, status: string) =>
    request(`/api/invoices/${id}/status`, { method: 'PATCH', body: { status } }),
  deleteInvoice: (id: string) =>
    request(`/api/invoices/${id}`, { method: 'DELETE' }),
  getInvoiceStats: (params?: Record<string, string>) =>
    request<{ stats: any; monthly: any[] }>('/api/invoices/stats', { params }),

  // Documents
  getExcelUrl: (id: string) => `${API_BASE}/api/invoices/${id}/excel`,
  getPdfUrl: (id: string) => `${API_BASE}/api/invoices/${id}/pdf`,
  getActUrl: (id: string) => `${API_BASE}/api/invoices/${id}/act`,
  getActPdfUrl: (id: string) => `${API_BASE}/api/invoices/${id}/act-pdf`,
  getPrintUrl: (id: string) => `${API_BASE}/api/invoices/${id}/print`,
  getActPrintUrl: (id: string) => `${API_BASE}/api/invoices/${id}/act-print`,

  // Billing
  getPlans: () => request<{ plans: any[] }>('/api/billing/plans'),
  getSubscription: () =>
    request<{ subscription: any; usage: any }>('/api/billing/subscription'),
  subscribe: (planId: string) =>
    request<{ subscription: any; paymentUrl?: string }>('/api/billing/subscribe', {
      method: 'POST',
      body: { planId },
    }),
  cancelSubscription: () =>
    request('/api/billing/cancel', { method: 'POST' }),
};
