// API client - uses local DB on mobile, HTTP on desktop/web
import {
  orgGetActive, orgGetAll, orgCreate, orgUpdate, orgDelete, orgSwitch,
  cpGetAll, cpCreate, cpUpdate, cpDelete,
  invGetAll, invGetOne, invGetStats, invCreate, invUpdate, invUpdateStatus, invDelete,
  billingGetPlans, billingGetSubscription, billingSubscribe, billingCancel,
  authRegister, authLogin, authLogout, authMe, authOnboardingDone,
} from '../lib/local-db';

// ===== API implementation =====
export const api = {
  // Auth
  register: authRegister,
  login: authLogin,
  logout: authLogout,
  me: authMe,
  forgotPassword: async () => ({ success: true }),
  resetPassword: async () => ({ success: true }),
  onboardingDone: authOnboardingDone,

  // Organizations
  getOrganizations: orgGetAll,
  getActiveOrganization: orgGetActive,
  createOrganization: orgCreate,
  updateOrganization: orgUpdate,
  switchOrganization: orgSwitch,
  deleteOrganization: orgDelete,

  // Counterparties
  getCounterparties: cpGetAll,
  createCounterparty: cpCreate,
  updateCounterparty: cpUpdate,
  deleteCounterparty: cpDelete,

  // Invoices
  getInvoices: invGetAll,
  getInvoice: invGetOne,
  getInvoiceStats: invGetStats,
  createInvoice: invCreate,
  updateInvoice: invUpdate,
  updateInvoiceStatus: invUpdateStatus,
  deleteInvoice: invDelete,

  // Documents - these are handled by the UI directly
  getExcelUrl: (id: string) => `local://excel/${id}`,
  getPdfUrl: (id: string) => `local://pdf/${id}`,
  getActUrl: (id: string) => `local://act/${id}`,
  getActPdfUrl: (id: string) => `local://act-pdf/${id}`,
  getPrintUrl: (id: string) => `local://print/${id}`,
  getActPrintUrl: (id: string) => `local://act-print/${id}`,

  // Billing
  getPlans: billingGetPlans,
  getSubscription: billingGetSubscription,
  subscribe: billingSubscribe,
  cancelSubscription: billingCancel,
};

// Exported config (no-op for local DB)
export function setServerUrl(_url: string) {}
export function getServerUrl(): string { return ''; }
export function isConfigured(): boolean { return true; }
