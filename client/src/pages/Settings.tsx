import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { startGlobalTour } from '../components/Tour';
import { Filesystem } from '@capacitor/filesystem';
import { showNotification, isNotificationsEnabled, setNotificationsEnabled } from '../lib/notifications';
import { downloadBlob } from '../lib/local-docs';
import './Settings.css';

const LEGAL_FORMS = ['ООО', 'ИП', 'АО (НАО)', 'ПАО', 'КООП', 'ГУП', 'МУП', 'ФЛ', 'СК'];
const isIP = (f: string) => f === 'ИП';
const isLegalEntity = (f: string) => f !== 'ИП';

// ===== COLLAPSIBLE BASIS ITEM =====
function BasisItem({ value, index, onChange, onRemove, canRemove }: {
  value: string; index: number; onChange: (val: string) => void; onRemove: () => void; canRemove: boolean;
}) {
  const [expanded, setExpanded] = useState(!value);

  return (
    <div className="basis-item">
      <div className="basis-item-header" onClick={() => setExpanded(!expanded)}>
        <span className="basis-item-chevron">{expanded ? '▾' : '▸'}</span>
        <span className="basis-item-label">Основание {index + 1}</span>
        {value && !expanded && <span className="basis-item-preview">{value}</span>}
        <div className="basis-item-actions" onClick={(e) => e.stopPropagation()}>
          {canRemove && (
            <button className="basis-remove-btn" onClick={onRemove} title="Удалить основание">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="basis-item-body">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Номер и дата договора"
            autoFocus={!value}
          />
        </div>
      )}
    </div>
  );
}

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function SettingsPage() {
  const [org, setOrg] = useState<any>(null);
  const [form, setForm] = useState({
    name:'', legalForm:'ООО', inn:'', kpp:'', ogrn:'', ogrnip:'',
    address:'', director:'', accountant:'',
    bankName:'', bankBik:'', bankCorr:'', bankAccount:'', downloadPath:'',
  });
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [showOrgList, setShowOrgList] = useState(false);
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [newOrgForm, setNewOrgForm] = useState({
    name:'', legalForm:'ООО', inn:'', kpp:'', ogrn:'', ogrnip:'',
    address:'', director:'', accountant:'',
    bankName:'', bankBik:'', bankCorr:'', bankAccount:'',
  });
  const [counterparties, setCounterparties] = useState<any[]>([]);
  const [showCpModal, setShowCpModal] = useState(false);
  const [editingCp, setEditingCp] = useState<any>(null);
  const [cpForm, setCpForm] = useState({ name:'', address:'', inn:'', kpp:'', ogrn:'', bases: [''] as string[] });
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const navigate = useNavigate();
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [backupDragOver, setBackupDragOver] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('billdo_theme') === 'dark');
  const [notificationsOn, setNotificationsOn] = useState(() => isNotificationsEnabled());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('billdo_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  function showToast(msg: string, type = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  }

  // Load active org and fill form
  const loadActiveOrg = useCallback(async () => {
    try {
      const res = await api.getActiveOrganization();
      const o = res.organization;
      if (!o) return;
      setOrg(o);
      setForm({
        name: o.name || '', legalForm: o.legalForm || 'ООО',
        inn: o.inn || '', kpp: o.kpp || '', ogrn: o.ogrn || '', ogrnip: o.ogrnip || '',
        address: o.address || '', director: o.director || '', accountant: o.accountant || '',
        bankName: o.bankName || '', bankBik: o.bankBik || '',
        bankCorr: o.bankCorr || '', bankAccount: o.bankAccount || '',
        downloadPath: o.downloadPath || '',
      });
    } catch {}
  }, []);

  const loadOrgs = useCallback(async () => {
    try { const res = await api.getOrganizations(); setOrganizations(res.organizations); } catch {}
  }, []);

  const loadCps = useCallback(async () => {
    try { const res = await api.getCounterparties(); setCounterparties(res.counterparties); } catch {}
  }, []);

  useEffect(() => { loadActiveOrg(); loadOrgs(); loadCps(); }, [loadActiveOrg, loadOrgs, loadCps]);

  // Save current org
  async function handleSave() {
    if (!org) return;
    try {
      await api.updateOrganization(org.id, form);
      showToast('Настройки сохранены');
      loadOrgs();
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  // Switch to a different org
  async function handleSwitchOrg(orgId: string) {
    try {
      await api.switchOrganization(orgId);
      await loadActiveOrg();
      await loadOrgs();
      setShowOrgList(false);
      showToast('Организация переключена');
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  // Create new org
  async function handleCreateOrg() {
    if (!newOrgForm.name) { showToast('Введите название', 'error'); return; }
    try {
      await api.createOrganization(newOrgForm);
      await loadActiveOrg();
      await loadOrgs();
      setShowNewOrgModal(false);
      setNewOrgForm({ name:'', legalForm:'ООО', inn:'', kpp:'', ogrn:'', ogrnip:'', address:'', director:'', accountant:'', bankName:'', bankBik:'', bankCorr:'', bankAccount:'' });
      const notif = showNotification('org_created', 'Организация «' + newOrgForm.name + '» создана');
      if (notif) showToast(notif.msg, notif.type); else showToast('Организация создана');
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  // Delete org
  async function handleDeleteOrg(orgId: string) {
    if (!confirm('Удалить организацию? Все счета будут потеряны!')) return;
    try {
      await api.deleteOrganization(orgId);
      await loadActiveOrg();
      await loadOrgs();
      showToast('Организация удалена');
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  // Counterparty CRUD
  function openCpCreate() { setEditingCp(null); setCpForm({ name:'', address:'', inn:'', kpp:'', ogrn:'', bases: [''] }); setShowCpModal(true); }
  function openCpEdit(cp: any) {
    setEditingCp(cp);
    const cpBases = Array.isArray(cp.bases) && cp.bases.length > 0
      ? cp.bases
      : cp.basis ? [cp.basis] : [''];
    setCpForm({ name: cp.name||'', address: cp.address||'', inn: cp.inn||'', kpp: cp.kpp||'', ogrn: cp.ogrn||'', bases: cpBases });
    setShowCpModal(true);
  }

  async function handleSaveCp() {
    if (!cpForm.name) { showToast('Введите название', 'error'); return; }
    try {
      if (editingCp) { await api.updateCounterparty(editingCp.id, cpForm); showToast('Покупатель обновлён'); }
      else {
        await api.createCounterparty(cpForm);
        const notif = showNotification('cp_created', 'Покупатель «' + cpForm.name + '» добавлен');
        if (notif) showToast(notif.msg, notif.type); else showToast('Покупатель добавлен');
      }
      setShowCpModal(false); loadCps();
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  async function handleDeleteCp(id: string) {
    if (!confirm('Удалить покупателя?')) return;
    try { await api.deleteCounterparty(id); loadCps(); showToast('Покупатель удалён'); }
    catch (err: any) { showToast(err.message, 'error'); }
  }

  // Export backup
  async function handleExportBackup() {
    try {
      showToast('Создание бэкапа...', 'info');
      const orgRes = await api.getOrganizations();
      const cpRes = await api.getCounterparties();
      const invRes = await api.getInvoices({});
      // Fetch full invoice details with positions
      const invoicesFull = [];
      for (const inv of invRes.invoices) {
        const full = await api.getInvoice(inv.id);
        if (full.invoice) invoicesFull.push(full.invoice);
      }
      const backup = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        organizations: orgRes.organizations,
        counterparties: cpRes.counterparties,
        invoices: invoicesFull,
      };
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Билл-до_бэкап_${dateStr}.json`;
      await downloadBlob(blob, filename);
      const notif = showNotification('backup_created');
      if (notif) showToast(notif.msg, notif.type); else showToast('Бэкап сохранён');
    } catch (err: any) { showToast(err.message || 'Ошибка экспорта', 'error'); }
  }

  // Import backup
  function handleImportBackupTrigger() {
    if (backupFileInputRef.current) {
      backupFileInputRef.current.value = '';
      backupFileInputRef.current.click();
    }
  }

  async function handleImportBackupFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.organizations && !backup.counterparties) {
        showToast('Неверный формат бэкапа', 'error');
        return;
      }
      showToast('Импорт данных...', 'info');
      const existingOrgs = await api.getOrganizations();
      const existingCps = await api.getCounterparties();
      const orgIdMap: Record<string, string> = {};
      const cpIdMap: Record<string, string> = {};
      let orgsImported = 0;
      let cpsImported = 0;
      let invoicesImported = 0;
      if (backup.organizations) {
        for (const orgData of backup.organizations) {
          const key = `${orgData.name}|${orgData.inn || ''}`;
          const existing = existingOrgs.organizations.find((o: any) => `${o.name}|${o.inn || ''}` === key);
          if (existing) {
            orgIdMap[orgData.id] = existing.id;
          } else {
            const res = await api.createOrganization(orgData) as any;
            if (res.organization) orgIdMap[orgData.id] = res.organization.id;
            orgsImported++;
          }
        }
      }
      if (backup.counterparties) {
        for (const cpData of backup.counterparties) {
          const existing = existingCps.counterparties.find((c: any) => c.name === cpData.name);
          if (existing) {
            cpIdMap[cpData.id] = existing.id;
          } else {
            const res = await api.createCounterparty(cpData) as any;
            if (res.counterparty) cpIdMap[cpData.id] = res.counterparty.id;
            cpsImported++;
          }
        }
      }
      if (backup.invoices && backup.invoices.length > 0) {
        for (const inv of backup.invoices) {
          try {
            const mappedCpId = cpIdMap[inv.counterpartyId] || inv.counterpartyId;
            await api.createInvoice({
              number: inv.number, date: inv.date, counterpartyId: mappedCpId,
              bases: inv.bases || [], serviceMonth: inv.serviceMonth, serviceYear: inv.serviceYear,
              vatType: inv.vatType, status: inv.status || 'sent',
              positions: (inv.positions || []).map((p: any) => ({ name: p.name, quantity: p.quantity, unit: p.unit, price: p.price })),
            });
            invoicesImported++;
          } catch (e) { console.warn('Skip invoice', inv.number, e); }
        }
      }
      await loadOrgs();
      await loadCps();
      const parts = [];
      if (orgsImported) parts.push(`${orgsImported} организаций`);
      if (cpsImported) parts.push(`${cpsImported} покупателей`);
      if (invoicesImported) parts.push(`${invoicesImported} счетов`);
      const msg = parts.length > 0 ? `Импортировано: ${parts.join(', ')}` : 'Все данные уже есть в системе';
      const notif = showNotification('backup_loaded', msg);
      if (notif) showToast(notif.msg, notif.type); else showToast(msg);
    } catch (err: any) {
      showToast(err.message || 'Ошибка импорта', 'error');
    }
  }

  async function handleImportBackupFromFile(file: File) {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.organizations && !backup.counterparties) {
        showToast('Неверный формат бэкапа', 'error');
        return;
      }
      showToast('Импорт данных...', 'info');
      const existingOrgs = await api.getOrganizations();
      const existingCps = await api.getCounterparties();
      // ID mapping: old ID → new ID
      const orgIdMap: Record<string, string> = {};
      const cpIdMap: Record<string, string> = {};
      let orgsImported = 0;
      let cpsImported = 0;
      let invoicesImported = 0;
      if (backup.organizations) {
        for (const orgData of backup.organizations) {
          const key = `${orgData.name}|${orgData.inn || ''}`;
          const existing = existingOrgs.organizations.find((o: any) => `${o.name}|${o.inn || ''}` === key);
          if (existing) {
            orgIdMap[orgData.id] = existing.id;
          } else {
            const res = await api.createOrganization(orgData) as any;
            if (res.organization) orgIdMap[orgData.id] = res.organization.id;
            orgsImported++;
          }
        }
      }
      if (backup.counterparties) {
        for (const cpData of backup.counterparties) {
          const existing = existingCps.counterparties.find((c: any) => c.name === cpData.name);
          if (existing) {
            cpIdMap[cpData.id] = existing.id;
          } else {
            const res = await api.createCounterparty(cpData) as any;
            if (res.counterparty) cpIdMap[cpData.id] = res.counterparty.id;
            cpsImported++;
          }
        }
      }
      // Import invoices with mapped IDs
      if (backup.invoices && backup.invoices.length > 0) {
        for (const inv of backup.invoices) {
          try {
            const mappedCpId = cpIdMap[inv.counterpartyId] || inv.counterpartyId;
            await api.createInvoice({
              number: inv.number,
              date: inv.date,
              counterpartyId: mappedCpId,
              bases: inv.bases || [],
              serviceMonth: inv.serviceMonth,
              serviceYear: inv.serviceYear,
              vatType: inv.vatType,
              status: inv.status || 'sent',
              positions: (inv.positions || []).map((p: any) => ({
                name: p.name, quantity: p.quantity, unit: p.unit, price: p.price,
              })),
            });
            invoicesImported++;
          } catch (e) {
            console.warn('Skip invoice', inv.number, e);
          }
        }
      }
      await loadOrgs();
      await loadCps();
      const parts = [];
      if (orgsImported) parts.push(`${orgsImported} организаций`);
      if (cpsImported) parts.push(`${cpsImported} покупателей`);
      if (invoicesImported) parts.push(`${invoicesImported} счетов`);
      const msg = parts.length > 0 ? `Импортировано: ${parts.join(', ')}` : 'Все данные уже есть в системе';
      const notif = showNotification('backup_loaded', msg);
      if (notif) showToast(notif.msg, notif.type); else showToast(msg);
    } catch (err: any) {
      showToast(err.message || 'Ошибка импорта', 'error');
    }
  }

  const isLE = isLegalEntity(form.legalForm);
  const isIPF = isIP(form.legalForm);

  return (
    <>
      <div className="page-hero">
        <h1>Настройки <em>сервиса.</em></h1>
        <div className="page-hero-sub">Реквизиты организации и управление аккаунтом</div>
      </div>

      <div className="settings-grid">
        {/* LEFT */}
        <div className="settings-left">

          {/* Organizations panel */}
          <div className="card">
            <div className="card-header">
              <h3>Организации</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {organizations.length > 1 && (
                  <button className="btn btn-sm btn-secondary" onClick={() => setShowOrgList(!showOrgList)}>
                    {showOrgList ? 'Свернуть' : `Все (${organizations.length})`}
                  </button>
                )}
                <button className="btn btn-sm btn-primary" onClick={() => setShowNewOrgModal(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                  Новая
                </button>
              </div>
            </div>

            {/* Current org badge when list is hidden */}
            {!showOrgList && org && (
              <div className="org-current">
                <div className="org-current-name">{org.name}</div>
                <div className="org-current-meta">{org.legalForm || 'ООО'} · ИНН {org.inn || '—'}</div>
              </div>
            )}

            {/* Full org list when expanded */}
            {showOrgList && (
              <div className="org-list">
                {organizations.map((o: any) => (
                  <div key={o.id} className={`org-item ${o.id === org?.id ? 'active' : ''}`}>
                    <div className="org-item-info" onClick={() => handleSwitchOrg(o.id)}>
                      <div className="org-item-name">{o.name}</div>
                      <div className="org-item-meta">{o.legalForm || 'ООО'} · ИНН {o.inn || '—'}</div>
                    </div>
                    {o.id === org?.id && organizations.length > 1 && (
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteOrg(o.id)} title="Удалить">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Org Details — edits the ACTIVE org */}
          <div className="card">
            <div className="card-header"><h3>Реквизиты организации</h3></div>
            {!org ? (
              <div className="empty-state-small">Создайте первую организацию</div>
            ) : (
              <>
                <div className="form-group">
                  <label>Организационно-правовая форма</label>
                  <select id="org-legalForm" value={form.legalForm} onChange={(e) => setForm({...form, legalForm: e.target.value})}>
                    {LEGAL_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Полное наименование</label><textarea rows={1} id="org-name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} style={{ minHeight: 44 }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} /></div>
                <div className="form-group"><label>ИНН *</label><input id="org-inn" value={form.inn} maxLength={12} onChange={(e) => setForm({...form, inn: e.target.value})} placeholder={isIPF ? '12 цифр (ИП)' : '10 цифр (юрлицо)'} /></div>
                {isLE && <div className="form-group"><label>КПП</label><input value={form.kpp} maxLength={9} onChange={(e) => setForm({...form, kpp: e.target.value})} placeholder="9 цифр" /></div>}
                {isLE && <div className="form-group"><label>ОГРН *</label><input value={form.ogrn} maxLength={15} onChange={(e) => setForm({...form, ogrn: e.target.value})} placeholder="13 цифр" /></div>}
                {isIPF && <div className="form-group"><label>ОГРНИП *</label><input value={form.ogrnip} maxLength={15} onChange={(e) => setForm({...form, ogrnip: e.target.value})} placeholder="15 цифр" /></div>}
                <div className="form-group"><label>Юридический адрес</label><textarea rows={1} id="org-address" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} style={{ minHeight: 44 }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} /></div>
                <div className="form-row">
                  <div className="form-group"><label>ФИО руководителя</label><input value={form.director} onChange={(e) => setForm({...form, director: e.target.value})} /></div>
                  <div className="form-group"><label>ФИО бухгалтера</label><input value={form.accountant} onChange={(e) => setForm({...form, accountant: e.target.value})} /></div>
                </div>
              </>
            )}
          </div>

          {/* Bank */}
          <div className="card">
            <div className="card-header"><h3>Банковские реквизиты</h3></div>
            <div className="form-group"><label>Банк получателя</label><input id="bank-name" value={form.bankName} onChange={(e) => setForm({...form, bankName: e.target.value})} /></div>
            <div className="form-row">
              <div className="form-group"><label>БИК</label><input value={form.bankBik} maxLength={9} onChange={(e) => setForm({...form, bankBik: e.target.value})} /></div>
              <div className="form-group"><label>Корр. счёт</label><input value={form.bankCorr} maxLength={20} onChange={(e) => setForm({...form, bankCorr: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Расчётный счёт</label><input value={form.bankAccount} maxLength={20} onChange={(e) => setForm({...form, bankAccount: e.target.value})} /></div>
          </div>

          {/* Download path */}
          <div className="card">
            <div className="card-header"><h3>Путь загрузок</h3></div>
            <div className="form-group">
              <label>Папка для скачивания счетов</label>
              <div className="download-path-row">
                <input value={form.downloadPath} onChange={(e) => setForm({...form, downloadPath: e.target.value})} placeholder="Например: ~/Documents/Счета" className="download-path-input" />
                <button className="btn btn-sm btn-secondary" onClick={async () => {
                  if ((window as any).electronAPI?.isElectron) {
                    const folder = await (window as any).electronAPI.selectFolder();
                    if (folder) {
                      setForm({...form, downloadPath: folder});
                      showToast('Папка выбрана');
                    }
                  } else {
                    try {
                      const result = await (Filesystem as any).pickDirectory();
                      if (result?.path) {
                        setForm({...form, downloadPath: result.path});
                        showToast('Папка выбрана');
                      }
                    } catch {
                      setForm({...form, downloadPath: 'Download/Билл-до'});
                      showToast('Установлена папка загрузок');
                    }
                  }
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                  Выбрать
                </button>
              </div>
              <span className="form-hint">Если не заполнено — файлы скачиваются в папку «Загрузки»</span>
            </div>
          </div>

          <div className="actions-bar">
            <button id="settings-save" className="btn btn-primary" onClick={handleSave} disabled={!org}>Сохранить настройки</button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="settings-right">
          <div className="card settings-preview-card">
            <div className="card-header"><h3>Как выглядит ваш счёт</h3></div>
            <AutoFillPreview form={form} />
          </div>

          <div className="card privacy-card">
            <div className="card-header"><h3>Конфиденциальность данных</h3></div>
            <div className="privacy-content">
              <div className="privacy-badge">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Ваши данные под надёжной защитой</span>
              </div>
              <div className="privacy-points">
                {[
                  ['Всё хранится на вашем компьютере', 'Все данные хранятся только здесь. Никаких сторонних сервисов.'],
                  ['Мы не передаём данные третьим лицам', 'Никакая информация не передаётся и не продаётся.'],
                  ['Счета генерируются локально', 'PDF и Excel создаются только по вашему запросу.'],
                ].map(([t, d], i) => (
                  <div key={i} className="privacy-point">
                    <div className="privacy-point-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                    <div><strong>{t}</strong><p>{d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Быстрые действия</h3></div>
            <div className="settings-actions">
              <button className="btn btn-secondary" style={{width:'100%'}} onClick={() => navigate('/invoice')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                Создать новый счёт
              </button>
              <button className="btn btn-secondary" style={{width:'100%'}} onClick={() => navigate('/journal')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                Открыть журнал
              </button>
              <button id="tour-replay" className="btn btn-secondary" style={{width:'100%'}} onClick={startGlobalTour}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                Показать гайд заново
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Тема оформления</h3></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>{darkMode ? 'Тёмная тема' : 'Светлая тема'}</span>
              <button
                onClick={() => setDarkMode(!darkMode)}
                style={{
                  width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: darkMode ? 'var(--accent-ink)' : 'var(--border-strong)',
                  position: 'relative', transition: 'background 0.3s'
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: 'white',
                  position: 'absolute', top: 3,
                  left: darkMode ? 27 : 3,
                  transition: 'left 0.3s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Уведомления</h3></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <div>
                <span style={{ fontSize: 14, color: 'var(--text)' }}>{notificationsOn ? 'Уведомления включены' : 'Уведомления выключены'}</span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Звук при создании счетов и организаций</div>
              </div>
              <button
                onClick={() => {
                  const next = !notificationsOn;
                  setNotificationsOn(next);
                  setNotificationsEnabled(next);
                  showToast(next ? 'Уведомления включены' : 'Уведомления выключены');
                }}
                style={{
                  width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: notificationsOn ? 'var(--accent-ink)' : 'var(--border-strong)',
                  position: 'relative', transition: 'background 0.3s'
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: 'white',
                  position: 'absolute', top: 3,
                  left: notificationsOn ? 27 : 3,
                  transition: 'left 0.3s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Покупатели</h3>
              <button className="btn btn-sm btn-primary" onClick={openCpCreate}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                Добавить
              </button>
            </div>
            {counterparties.length === 0 ? (
              <div className="empty-state-small">Пока нет покупателей</div>
            ) : (
              <div className="cp-list">
                {counterparties.map(cp => (
                  <div key={cp.id} className="cp-item">
                    <div className="cp-item-info">
                      <div className="cp-item-name">{cp.name}</div>
                      <div className="cp-item-meta">{cp.inn ? `ИНН ${cp.inn}` : ''}{cp.ogrn ? ` · ОГРН ${cp.ogrn}` : ''}</div>
                    </div>
                    <div className="cp-item-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => openCpEdit(cp)} title="Редактировать">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCp(cp.id)} title="Удалить">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Backup/Restore card */}
          <div className="card">
            <div className="card-header"><h3>Бэкап данных</h3></div>
            <div className="settings-actions">
              <button className="btn btn-secondary" style={{width:'100%'}} onClick={handleExportBackup}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Сохранить бэкап
              </button>
              <button className="btn btn-secondary" style={{width:'100%'}} onClick={handleImportBackupTrigger}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Загрузить из бэкапа
              </button>
              <input ref={backupFileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportBackupFile} />
            </div>
            <div
              className={`backup-dropzone ${backupDragOver ? 'backup-dropzone--active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setBackupDragOver(true); }}
              onDragLeave={() => setBackupDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setBackupDragOver(false); const file = e.dataTransfer.files[0]; if (file && file.name.endsWith('.json')) { handleImportBackupFromFile(file); } else { showToast('Нужен .json файл', 'error'); } }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Перетащите файл бэкапа сюда</span>
            </div>
          </div>
        </div>
      </div>

      {/* New Org Modal */}
      <Modal open={showNewOrgModal} onClose={() => setShowNewOrgModal(false)} title="Новая организация">
        <div className="modal-body">
          <div className="form-group">
            <label>Организационно-правовая форма</label>
            <select value={newOrgForm.legalForm} onChange={(e) => setNewOrgForm({...newOrgForm, legalForm: e.target.value})}>
              {LEGAL_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Наименование *</label><textarea rows={1} value={newOrgForm.name} onChange={(e) => setNewOrgForm({...newOrgForm, name: e.target.value})} autoFocus style={{ minHeight: 44 }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} /></div>
          <div className="form-group"><label>ИНН</label><input value={newOrgForm.inn} maxLength={12} onChange={(e) => setNewOrgForm({...newOrgForm, inn: e.target.value})} /></div>
          {isLegalEntity(newOrgForm.legalForm) && <div className="form-group"><label>КПП</label><input value={newOrgForm.kpp} maxLength={9} onChange={(e) => setNewOrgForm({...newOrgForm, kpp: e.target.value})} /></div>}
          {isLegalEntity(newOrgForm.legalForm) && <div className="form-group"><label>ОГРН</label><input value={newOrgForm.ogrn} maxLength={15} onChange={(e) => setNewOrgForm({...newOrgForm, ogrn: e.target.value})} /></div>}
          {isIP(newOrgForm.legalForm) && <div className="form-group"><label>ОГРНИП</label><input value={newOrgForm.ogrnip} maxLength={15} onChange={(e) => setNewOrgForm({...newOrgForm, ogrnip: e.target.value})} /></div>}
          <div className="form-group"><label>Адрес</label><textarea rows={1} value={newOrgForm.address} onChange={(e) => setNewOrgForm({...newOrgForm, address: e.target.value})} style={{ minHeight: 44 }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} /></div>
          <div className="form-row">
            <div className="form-group"><label>Руководитель</label><input value={newOrgForm.director} onChange={(e) => setNewOrgForm({...newOrgForm, director: e.target.value})} /></div>
            <div className="form-group"><label>Бухгалтер</label><input value={newOrgForm.accountant} onChange={(e) => setNewOrgForm({...newOrgForm, accountant: e.target.value})} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowNewOrgModal(false)}>Отмена</button>
          <button className="btn btn-primary" onClick={handleCreateOrg}>Создать</button>
        </div>
      </Modal>

      {/* Counterparty Modal */}
      <Modal open={showCpModal} onClose={() => setShowCpModal(false)} title={editingCp ? 'Редактировать покупателя' : 'Добавить покупателя'}>
        <div className="modal-body">
          <div className="form-group"><label>Наименование *</label><textarea rows={1} value={cpForm.name} onChange={(e) => setCpForm({...cpForm, name: e.target.value})} autoFocus style={{ minHeight: 44 }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} /></div>
          <div className="form-group"><label>Адрес</label><textarea rows={1} value={cpForm.address} onChange={(e) => setCpForm({...cpForm, address: e.target.value})} style={{ minHeight: 44 }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} /></div>
          <div className="form-row">
            <div className="form-group"><label>ИНН</label><input value={cpForm.inn} maxLength={12} onChange={(e) => setCpForm({...cpForm, inn: e.target.value})} /></div>
            <div className="form-group"><label>КПП</label><input value={cpForm.kpp} maxLength={9} onChange={(e) => setCpForm({...cpForm, kpp: e.target.value})} /></div>
          </div>
          <div className="form-group"><label>ОГРН</label><input value={cpForm.ogrn} maxLength={15} onChange={(e) => setCpForm({...cpForm, ogrn: e.target.value})} /></div>
          <div className="form-group">
            <label>Основания (договоры)</label>
            <div className="bases-list">
              {cpForm.bases.map((b, i) => (
                <BasisItem
                  key={i}
                  value={b}
                  index={i}
                  onChange={(val) => {
                    const newBases = [...cpForm.bases];
                    newBases[i] = val;
                    setCpForm({...cpForm, bases: newBases});
                  }}
                  onRemove={() => {
                    setCpForm({...cpForm, bases: cpForm.bases.filter((_, j) => j !== i)});
                  }}
                  canRemove={cpForm.bases.length > 1}
                />
              ))}
            </div>
            <button className="btn btn-sm btn-secondary basis-add-btn" onClick={() => setCpForm({...cpForm, bases: [...cpForm.bases, '']})}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              Добавить основание
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowCpModal(false)}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSaveCp}>{editingCp ? 'Обновить' : 'Сохранить'}</button>
        </div>
      </Modal>

      {toast && <div className="toast-container"><div className={`toast ${toast.type}`} onClick={() => setToast(null)}>{toast.msg}</div></div>}
    </>
  );
}

/* ── Preview ── */
function AutoFillPreview({ form }: { form: any }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= 12; i++) t.push(setTimeout(() => setPhase(i), i * 350));
    return () => t.forEach(clearTimeout);
  }, []);
  const cls = (min: number) => `mp-type ${phase >= min ? 'mp-visible' : ''}`;
  const ipf = form.legalForm === 'ИП';
  return (
    <div className="settings-mini-preview">
      <div className={`mp-header ${cls(1)}`}><div className="mp-logo">С</div><div className="mp-header-text"><TypewriterLine text="Счёт на оплату № 1" className="mp-title" active={phase >= 1} /><TypewriterLine text={`от ${new Date().toLocaleDateString('ru-RU')} г.`} className="mp-date" active={phase >= 1} delay={200} /></div></div>
      <div className={`mp-section ${cls(2)}`}><div className="mp-label">Поставщик</div><TypewriterLine text={form.name || `${form.legalForm} «Ваша Компания»`} className="mp-value" active={phase >= 2} /><TypewriterLine text={ipf ? (form.inn ? `ИНН ${form.inn} · ОГРНИП ${form.ogrnip || '—'}` : 'ИНН · ОГРНИП') : (form.inn ? `ИНН ${form.inn} · КПП ${form.kpp || '—'}` : 'ИНН · КПП')} className="mp-sub" active={phase >= 3} delay={100} /><TypewriterLine text={form.address || 'Адрес организации'} className="mp-sub" active={phase >= 3} delay={250} /></div>
      <div className={`mp-section ${cls(4)}`}><div className="mp-label">Банк</div><TypewriterLine text={form.bankName || 'Ваш банк'} className="mp-value" active={phase >= 4} /><TypewriterLine text={(form.bankBik || form.bankAccount) ? `БИК ${form.bankBik || '—'} · Р/с ${form.bankAccount || '—'}` : 'БИК · Р/с'} className="mp-sub" active={phase >= 5} delay={100} /></div>
      <div className={`mp-divider ${cls(6)}`} />
      <div className={`mp-section ${cls(6)}`}><div className="mp-label">Покупатель</div><TypewriterLine text="ООО «Партнёр»" className="mp-value" active={phase >= 6} /><TypewriterLine text="ИНН 7709876543 · г. Санкт-Петербург" className="mp-sub" active={phase >= 7} delay={100} /></div>
      <div className={`mp-table ${cls(8)}`}><div className="mp-row mp-head"><span>№</span><span>Наименование</span><span>Сумма</span></div><div className={`mp-row ${cls(8)}`}><span>1</span><span>Консультационные услуги</span><span>50 000 ₽</span></div><div className={`mp-row ${cls(9)}`}><span>2</span><span>Техническая поддержка</span><span>15 000 ₽</span></div></div>
      <TypewriterLine text="Итого: 65 000,00 ₽" className="mp-total" active={phase >= 10} />
      <div className={`mp-sign ${cls(11)}`}><div><div className="mp-sign-label">{ipf ? 'ИП' : 'Руководитель'}</div><TypewriterLine text={form.director || 'Иванов И.И.'} className="mp-sign-line" active={phase >= 11} /></div><div><div className="mp-sign-label">Бухгалтер</div><TypewriterLine text={form.accountant || 'Петрова А.С.'} className="mp-sign-line" active={phase >= 12} /></div></div>
    </div>
  );
}

function TypewriterLine({ text, className, active, delay = 0 }: { text: string; className: string; active: boolean; delay?: number; }) {
  const [displayed, setDisplayed] = useState('');
  const [cursor, setCursor] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => { if (!active) { setDisplayed(''); setStarted(false); return; } const t = setTimeout(() => setStarted(true), delay); return () => clearTimeout(t); }, [active, delay]);
  useEffect(() => { if (!started) return; if (displayed.length < text.length) { const t = setTimeout(() => { setDisplayed(text.slice(0, displayed.length + 1)); setCursor(true); }, 25 + Math.random() * 35); return () => clearTimeout(t); } else { const t = setTimeout(() => setCursor(false), 600); return () => clearTimeout(t); } }, [displayed, text, started]);
  if (!active && !started) return <div className={className} style={{ opacity: 0, height: '1.2em' }} />;
  return <div className={className}>{displayed}{cursor && <span className="mp-cursor">|</span>}</div>;
}
