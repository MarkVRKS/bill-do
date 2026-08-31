import { create } from 'zustand';
import { api } from '../api/client';

export interface Position {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
}

interface InvoiceState {
  // Form state
  number: string;
  date: string;
  counterpartyId: string | null;
  bases: string[];
  serviceMonth: number;
  serviceYear: number;
  vatType: string;
  positions: Position[];
  editingId: string | null;
  lastSavedId: string | null;

  // Actions
  setField: (field: string, value: any) => void;
  addBasis: () => void;
  removeBasis: (index: number) => void;
  updateBasis: (index: number, value: string) => void;
  addPosition: () => void;
  removePosition: (id: string) => void;
  updatePosition: (id: string, field: string, value: any) => void;
  reset: () => void;
  loadInvoice: (invoice: any) => void;
  loadBasesFromCounterparty: (bases: string[]) => void;
  getNextNumber: () => Promise<void>;
  saveDraft: () => void;
  loadDraft: () => boolean;
}

let posCounter = 0;

function generatePosId(): string {
  return `pos_${++posCounter}_${Date.now()}`;
}

function getDefaultDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getDefaultMonth(): number {
  return new Date().getMonth() + 1;
}

function getDefaultYear(): number {
  return new Date().getFullYear();
}

const DRAFT_KEY = 'invoice_draft';

function getInitialState() {
  return {
    number: '1',
    date: getDefaultDate(),
    counterpartyId: null,
    bases: [''],
    serviceMonth: getDefaultMonth(),
    serviceYear: getDefaultYear(),
    vatType: 'none',
    positions: [{ id: generatePosId(), name: '', quantity: 1, unit: 'шт.', price: 0 }],
    editingId: null,
    lastSavedId: null,
  };
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  ...getInitialState(),

  setField: (field, value) => set({ [field]: value }),

  addBasis: () =>
    set((state) => ({ bases: [...state.bases, ''] })),

  removeBasis: (index) =>
    set((state) => ({
      bases: state.bases.filter((_, i) => i !== index),
    })),

  updateBasis: (index, value) =>
    set((state) => ({
      bases: state.bases.map((b, i) => (i === index ? value : b)),
    })),

  addPosition: () =>
    set((state) => ({
      positions: [
        ...state.positions,
        { id: generatePosId(), name: '', quantity: 1, unit: 'шт.', price: 0 },
      ],
    })),

  removePosition: (id) =>
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    })),

  updatePosition: (id, field, value) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    })),

  reset: () => {
    const initial = getInitialState();
    set(initial);
    localStorage.removeItem(DRAFT_KEY);
  },

  loadInvoice: (inv) =>
    set({
      number: inv.number,
      date: inv.date,
      counterpartyId: inv.counterpartyId,
      bases: Array.isArray(inv.bases) && inv.bases.length > 0
        ? inv.bases
        : inv.basis ? [inv.basis] : [''],
      serviceMonth: inv.serviceMonth,
      serviceYear: inv.serviceYear,
      vatType: inv.vatType,
      positions: inv.positions?.length
        ? inv.positions.map((p: any) => ({
            id: generatePosId(),
            name: p.name,
            quantity: parseFloat(p.quantity),
            unit: p.unit,
            price: parseFloat(p.price),
          }))
        : [{ id: generatePosId(), name: '', quantity: 1, unit: 'шт.', price: 0 }],
      editingId: inv.id,
      lastSavedId: inv.id,
    }),

  loadBasesFromCounterparty: (bases) =>
    set((state) => {
      // Only auto-fill if bases are empty (all blank)
      const hasContent = state.bases.some(b => b.trim());
      if (hasContent) return state;
      return {
        bases: bases.length > 0 ? [...bases] : [''],
      };
    }),

  getNextNumber: async () => {
    try {
      const { organization } = await api.getActiveOrganization();
      set({ number: String(organization.nextInvoiceNumber || 1) });
    } catch {
      // ignore
    }
  },

  saveDraft: () => {
    const state = get();
    const draft = {
      number: state.number,
      date: state.date,
      counterpartyId: state.counterpartyId,
      bases: state.bases,
      serviceMonth: state.serviceMonth,
      serviceYear: state.serviceYear,
      vatType: state.vatType,
      positions: state.positions,
      editingId: state.editingId,
      lastSavedId: state.lastSavedId,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  },

  loadDraft: (): boolean => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const draft = JSON.parse(raw);
      set({
        ...draft,
        positions: draft.positions?.length
          ? draft.positions.map((p: any) => ({
              ...p,
              id: p.id || generatePosId(),
            }))
          : [{ id: generatePosId(), name: '', quantity: 1, unit: 'шт.', price: 0 }],
        bases: Array.isArray(draft.bases) && draft.bases.length > 0 ? draft.bases : [''],
      });
      return true;
    } catch {
      return false;
    }
  },
}));
