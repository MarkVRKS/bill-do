import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { CustomSelect } from '../components/CustomSelect';
import { showNotification } from '../lib/notifications';
import { generateInvoiceExcel, generateActExcel, generateInvoiceHtml, generateActHtml, downloadBlob, shareHtml } from '../lib/local-docs';

const MONTHS_GEN = ['','января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_NOM = ['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
function fmt(n: string | number) { return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n)); }

function TooltipButton({ children, tooltip, onClick, className, style }: {
  children: React.ReactNode; tooltip: string; onClick?: () => void; className?: string; style?: React.CSSProperties;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="tooltip-wrap" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} style={{ position: 'relative', display: 'inline-flex' }}>
      <button className={className} onClick={onClick} style={style}>{children}</button>
      {show && <div className="tooltip-bubble">{tooltip}</div>}
    </div>
  );
}

function numberToWords(num: number): string {
  if (num === 0) return 'Ноль рублей 00 копеек';
  const ones=['','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
  const onesF=['','одна','две','три','четыре','пять','шесть','семь','восемь','девять'];
  const teens=['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const tensA=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
  const hundreds=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
  function grp(n:number,f:boolean){let r='';if(n>=100){r+=hundreds[Math.floor(n/100)]+' ';n%=100}if(n>=20){r+=tensA[Math.floor(n/10)]+' ';n%=10}else if(n>=10)return r+teens[n-10]+' ';if(n>0)r+=(f?onesF:ones)[n]+' ';return r}
  function rubF(n:number){const l2=n%100,l1=n%10;if(l2>=11&&l2<=19)return'рублей';if(l1===1)return'рубль';if(l1>=2&&l1<=4)return'рубля';return'рублей'}
  function kopF(n:number){if(n===0)return'копеек';const l2=n%100,l1=n%10;if(l2>=11&&l2<=19)return'копеек';if(l1===1)return'копейка';if(l1>=2&&l1<=4)return'копейки';return'копеек'}
  function intF(n:number,w:string,f1:string,f23:string,f5:string){if(n===0)return'';const l2=n%100,l1=n%10;let s=f5;if(l2>=11&&l2<=19)s=f5;else if(l1===1)s=f1;else if(l1>=2&&l1<=4)s=f23;return grp(n>=1000?n%1000:n,w==='тысяч')+w+s+' '}
  const rub=Math.floor(num),kop=Math.round((num-rub)*100);let r='';
  if(rub>=1e9)r+=intF(Math.floor(rub/1e9),'миллиард','','а','ов');
  if(rub>=1e6)r+=intF(Math.floor((rub%1e9)/1e6),'миллион','','а','ов');
  if(rub>=1e3)r+=intF(Math.floor((rub%1e6)/1e3),'тысяч','а','и','');
  const rem=rub%1000;if(rem>0||rub===0)r+=grp(rem,false);
  r=r.trim()+' '+rubF(rub);r+=' '+kop.toString().padStart(2,'0')+' '+kopF(kop);return r.charAt(0).toUpperCase()+r.slice(1);
}

export function JournalPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [downloadPath, setDownloadPath] = useState('');
  const [showPathWarning, setShowPathWarning] = useState(false);
  const [previewInv, setPreviewInv] = useState<any>(null);
  const [previewOrg, setPreviewOrg] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api.getActiveOrganization().then(res => {
      setDownloadPath(res.organization?.downloadPath || '');
      setPreviewOrg(res.organization);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${lastDay}`;
    setDateFrom(from); setDateTo(to);
  }, []);

  // Re-fetch invoices when navigating to this page or when filters change
  useEffect(() => { loadInvoices(); }, [dateFrom, dateTo, statusFilter, location.pathname]);

  async function loadInvoices() {
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.getInvoices(params);
      setInvoices(res.invoices);
    } catch {}
  }

  function showToast(msg: string, type = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await api.updateInvoiceStatus(id, status);
      loadInvoices();
      const STATUS_LABELS: Record<string, string> = { draft: 'Черновик', sent: 'Выставлен', paid: 'Оплачен', overdue: 'Просрочен' };
      const notif = showNotification('status_changed', 'Статус: ' + (STATUS_LABELS[status] || status));
      if (notif) showToast(notif.msg, notif.type); else showToast('Статус обновлён');
    }
    catch (err: any) { showToast(err.message, 'error'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить счёт?')) return;
    try { await api.deleteInvoice(id); loadInvoices(); showToast('Счёт удалён'); }
    catch (err: any) { showToast(err.message, 'error'); }
  }

  // Refresh when page becomes visible again (e.g., after creating invoice)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadInvoices();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [dateFrom, dateTo, statusFilter, search]);

  function handleSearch() { loadInvoices(); }

  function buildFullName(type: 'invoice' | 'act', inv: any): string {
    const prefix = type === 'invoice' ? 'Счет_на_оплату' : 'Акт_оказанных_услуг';
    const safeOrg = (previewOrg?.legalForm || 'ООО').replace(/[^а-яА-Яa-zA-Z]/g, '');
    const safeCp = (inv.counterpartyName || 'без_покупателя').replace(/[^а-яА-Яa-zA-Z0-9]/g, '_');
    const month = MONTHS_NOM[inv.serviceMonth] || '';
    return `${prefix}_№${inv.number}_${safeOrg}_${safeCp}_${month}_${inv.serviceYear}`;
  }

  function handleDownloadExcel(inv: any) {
    showToast('Генерация Excel...', 'info');
    generateInvoiceExcel(inv.id).then(blob => {
      downloadBlob(blob, buildFullName('invoice', inv) + '.xlsx');
      showToast('Excel скачан');
    }).catch(e => showToast(e.message, 'error'));
  }

  function handleDownloadPdf(inv: any) {
    showToast('Генерация PDF...', 'info');
    generateInvoiceHtml(inv.id).then(html => {
      shareHtml(html, buildFullName('invoice', inv));
      showToast('PDF готов');
    }).catch(e => showToast(e.message, 'error'));
  }

  function handleDownloadActExcel(inv: any) {
    showToast('Генерация акта Excel...', 'info');
    generateActExcel(inv.id).then(blob => {
      downloadBlob(blob, buildFullName('act', inv) + '.xlsx');
      showToast('Акт Excel скачан');
    }).catch(e => showToast(e.message, 'error'));
  }

  function handleDownloadActPdf(inv: any) {
    showToast('Генерация PDF акта...', 'info');
    generateActHtml(inv.id).then(html => {
      shareHtml(html, buildFullName('act', inv));
      showToast('PDF акта готов');
    }).catch(e => showToast(e.message, 'error'));
  }

  function handlePrintInvoice(inv: any) {
    showToast('Подготовка печати...', 'info');
    generateInvoiceHtml(inv.id).then(html => {
      shareHtml(html, buildFullName('invoice', inv));
    }).catch(e => showToast(e.message || 'Ошибка печати', 'error'));
  }

  function handlePrintAct(inv: any) {
    showToast('Подготовка печати...', 'info');
    generateActHtml(inv.id).then(html => {
      shareHtml(html, buildFullName('act', inv));
    }).catch(e => showToast(e.message || 'Ошибка печати', 'error'));
  }

  async function handleBulkExport() {
    if (invoices.length === 0) {
      showToast('Нет документов для выгрузки', 'error');
      return;
    }
    showToast('Подготовка файлов...', 'info');

    try {
      for (const inv of invoices) {
        const invoiceBlob = await generateInvoiceExcel(inv.id);
        downloadBlob(invoiceBlob, buildFullName('invoice', inv) + '.xlsx');
        const actBlob = await generateActExcel(inv.id);
        downloadBlob(actBlob, buildFullName('act', inv) + '.xlsx');
      }
      showToast('Готово! Файлы сохранены');
    } catch (err: any) {
      showToast(err.message || 'Ошибка экспорта', 'error');
    }
  }

  async function handlePreview(inv: any) {
    try {
      const full = await api.getInvoice(inv.id);
      setPreviewInv(full.invoice);
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function resetFilters() {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${lastDay}`;
    setSearch(''); setDateFrom(from); setDateTo(to); setStatusFilter('');
  }

  const totalSum = invoices.reduce((s, inv) => s + Number(inv.total || 0), 0);
  const counts = { paid: 0, sent: 0, draft: 0, overdue: 0 };
  invoices.forEach(inv => { (counts as any)[inv.status] = ((counts as any)[inv.status] || 0) + 1; });

  const basisPreview = (inv: any) => {
    if (inv.bases && inv.bases.length > 0) return inv.bases.filter((b: string) => b && b.trim()).join('; ');
    return inv.basis || '—';
  };

  return (
    <>
      <div className="page-hero">
        <h1>Журнал <em>счетов.</em></h1>
        <div className="page-hero-sub">Все выставленные счета и акты в одном месте</div>
      </div>
      <div className="card">
        <div className="card-header"><h3>Фильтры</h3></div>
        <div className="filter-bar">
          <div className="form-group"><label>Поиск</label><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Номер, покупатель..." /></div>
          <div className="form-group"><label>Дата от</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div className="form-group"><label>Дата до</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <div className="form-group"><label>Статус</label>
            <CustomSelect
              options={[
                { value: '', label: 'Все' },
                { value: 'draft', label: 'Черновик' },
                { value: 'sent', label: 'Выставлен' },
                { value: 'paid', label: 'Оплачен' },
                { value: 'overdue', label: 'Просрочен' },
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
            />
          </div>
          <button className="btn btn-sm btn-secondary" onClick={resetFilters}>Сбросить</button>
        </div>
        <div className="journal-dashboard">
          <div className="journal-metric-card"><div className="journal-metric-label">Сумма счетов</div><div className="journal-metric-value">{fmt(totalSum)} ₽</div></div>
          <div className="journal-metric-card"><div className="journal-metric-label">Количество</div><div className="journal-metric-value">{invoices.length}</div></div>
          <div className="journal-metric-card"><div className="journal-metric-label">Средний чек</div><div className="journal-metric-value">{invoices.length ? fmt(totalSum / invoices.length) : '—'} ₽</div></div>
          <div className="journal-metric-card"><div className="journal-metric-label">Статусы</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Оплачено: <strong>{counts.paid}</strong> · Ожидает: <strong>{counts.sent + counts.draft}</strong> · Просрочено: <strong>{counts.overdue}</strong></div></div>
        </div>
        {invoices.length > 0 && (
          <div className="journal-export-bar">
            <div className="journal-export-info">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <div>
                <div className="journal-export-title">Выгрузить все документы</div>
                <div className="journal-export-desc">Сохранить все счета и акты в форматах Excel и PDF</div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleBulkExport}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Выгрузить
            </button>
          </div>
        )}
        <div className="table-wrap">
          {invoices.length > 0 && (
            <div className="journal-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              Нажмите на значок <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',margin:'0 2px'}}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> рядом со счётом, чтобы увидеть документы для скачивания
            </div>
          )}
          <table className="table">
            <thead><tr><th style={{width:32}}></th><th>№</th><th>Дата</th><th>Покупатель</th><th>Основание</th><th>Сумма</th><th>Статус</th><th>Действия</th></tr></thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Нет счетов</td></tr>
              ) : (
                [...invoices].reverse().map((inv) => {
                  const isExpanded = expandedRows.has(inv.id);
                  return (
                    <React.Fragment key={inv.id}>
                      <tr className={isExpanded ? 'row-expanded' : ''}>
                        <td>
                          <button className="row-expand-btn" onClick={() => toggleRow(inv.id)} title="Документы">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(180deg)' : '', transition: 'transform 0.2s cubic-bezier(0.33, 1, 0.68, 1)' }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </button>
                        </td>
                        <td><strong>{inv.number}</strong></td>
                        <td>{inv.date?.split('-').reverse().join('.')}</td>
                        <td>{inv.counterpartyName || '—'}</td>
                        <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{basisPreview(inv)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmt(inv.total)} ₽</td>
                        <td>
                          <select className={`status-badge ${inv.status}`} value={inv.status} onChange={(e) => handleStatusChange(inv.id, e.target.value)} style={{ border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                            <option value="draft">Черновик</option><option value="sent">Выставлен</option><option value="paid">Оплачен</option><option value="overdue">Просрочен</option>
                          </select>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div className="btn-group">
                            <TooltipButton tooltip="Предпросмотр" className="btn btn-sm btn-secondary" onClick={() => handlePreview(inv)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </TooltipButton>
                            <TooltipButton tooltip="Редактировать" className="btn btn-sm btn-secondary" onClick={() => navigate(`/invoice/${inv.id}`)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </TooltipButton>
                            <TooltipButton tooltip="Удалить" className="btn btn-sm btn-danger" onClick={() => handleDelete(inv.id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </TooltipButton>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="expanded-row">
                          <td colSpan={8}>
                            <div className="expanded-docs">
                              <div className="expanded-docs-title">Документы счёта №{inv.number}</div>
                              <div className="expanded-docs-grid">
                                {/* Invoice documents */}
                                <div className="doc-card">
                                  <div className="doc-card-icon doc-card-icon--invoice">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  </div>
                                  <div className="doc-card-info">
                                    <div className="doc-card-name">Счёт на оплату</div>
                                    <div className="doc-card-meta">№{inv.number} · {fmt(inv.totalWithVat)} ₽</div>
                                  </div>
                                  <div className="doc-card-actions">
                                    <TooltipButton tooltip="Скачать PDF" className="btn btn-xs btn-secondary" onClick={() => handleDownloadPdf(inv)}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                      PDF
                                    </TooltipButton>
                                    <TooltipButton tooltip="Скачать Excel" className="btn btn-xs btn-secondary" onClick={() => handleDownloadExcel(inv)}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                                      Excel
                                    </TooltipButton>
                                    <TooltipButton tooltip="Печать счёта" className="btn btn-xs btn-secondary" onClick={() => handlePrintInvoice(inv)}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                      Печать
                                    </TooltipButton>
                                  </div>
                                </div>
                                {/* Act document */}
                                <div className="doc-card">
                                  <div className="doc-card-icon doc-card-icon--act">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                  </div>
                                  <div className="doc-card-info">
                                    <div className="doc-card-name">Акт оказанных услуг</div>
                                    <div className="doc-card-meta">№{inv.number} · {MONTHS_GEN[inv.serviceMonth] || ''} {inv.serviceYear}</div>
                                  </div>
                                  <div className="doc-card-actions">
                                    <TooltipButton tooltip="Скачать PDF акт" className="btn btn-xs btn-secondary" onClick={() => handleDownloadActPdf(inv)}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                      PDF
                                    </TooltipButton>
                                    <TooltipButton tooltip="Скачать Excel акт" className="btn btn-xs btn-secondary" onClick={() => handleDownloadActExcel(inv)}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                                      Excel
                                    </TooltipButton>
                                    <TooltipButton tooltip="Печать акта" className="btn btn-xs btn-secondary" onClick={() => handlePrintAct(inv)}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                      Печать
                                    </TooltipButton>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {invoices.length > 0 && (
          <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: 'var(--accent-light)', border: '1px solid rgba(126,154,140,0.2)', borderRadius: 12, marginTop: 12, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <span>Найдено: <strong style={{ color: 'var(--accent-ink)' }}>{invoices.length}</strong></span>
            <span>Сумма: <strong style={{ color: 'var(--accent-ink)' }}>{fmt(totalSum)} ₽</strong></span>
          </div>
        )}
      </div>

      {toast && <div className="toast-container"><div className={`toast ${toast.type}`} onClick={() => setToast(null)}>{toast.msg}</div></div>}

      {previewInv && createPortal(
        <div className="modal-overlay journal-preview-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewInv(null); }} style={{ zIndex: 9999 }}>
          <div className="modal journal-preview-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: '90vh', overflow: 'auto', zIndex: 10000 }}>
            <div className="modal-header">
              <h3>Предпросмотр счёта № {previewInv.number}</h3>
              <button className="modal-close" onClick={() => setPreviewInv(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <div className="invoice-preview">
                <div className="invoice-title">Счёт на оплату № {previewInv.number} от {previewInv.date?.split('-').reverse().join('.')} г.</div>
                {previewOrg && (
                  <div className="bank-block">
                    <table><tbody>
                      <tr><td className="bl" style={{width:'18%'}}>Банк получателя</td><td className="bacc" colSpan={3}>{previewOrg.bankName || '—'}</td></tr>
                      <tr><td className="bl">БИК</td><td className="bv">{previewOrg.bankBik || '—'}</td><td className="bl">Сч. №</td><td className="bv">{previewOrg.bankCorr || '—'}</td></tr>
                      <tr><td className="bl">ИНН</td><td className="bv">{previewOrg.inn || '—'}</td><td className="bl">КПП</td><td className="bv">{previewOrg.kpp || '—'}</td></tr>
                      <tr><td className="bl">Сч. №</td><td className="bacc" colSpan={3}>{previewOrg.bankAccount || '—'}</td></tr>
                      <tr><td className="bl">Получатель</td><td className="bacc" colSpan={3}>{previewOrg.name || '—'}</td></tr>
                    </tbody></table>
                  </div>
                )}
                <div className="parties-block">
                  <div className="party-row"><span className="party-label">Поставщик:</span><span className="party-value">{previewOrg?.name || '—'}, ИНН {previewOrg?.inn || '—'}, {previewOrg?.address || ''}</span></div>
                  <div className="party-row"><span className="party-label">Покупатель:</span><span className="party-value">{previewInv.counterpartyName || '—'}</span></div>
                </div>
                <div className="basis-block">Основание: {basisPreview(previewInv)}</div>
                <div className="invoice-table-wrap">
                  <table className="invoice-table">
                    <thead><tr><th style={{width:'5%'}}>№</th><th style={{width:'53%'}}>Товары (работы, услуги)</th><th style={{width:'7%'}}>Кол-во</th><th style={{width:'7%'}}>Ед.</th><th style={{width:'12%'}}>Цена</th><th style={{width:'12%'}}>Сумма</th></tr></thead>
                    <tbody>
                      {(previewInv.positions || []).map((pos: any, i: number) => (
                        <tr key={i}><td style={{textAlign:'center'}}>{i + 1}</td><td>{pos.name}</td><td style={{textAlign:'center'}}>{pos.quantity}</td><td style={{textAlign:'center'}}>{pos.unit}</td><td style={{textAlign:'right'}}>{fmt(pos.price)}</td><td style={{textAlign:'right'}}>{fmt(pos.amount)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="invoice-totals">
                  <p>Итого: {fmt(previewInv.total)}</p>
                  {previewInv.vatType === 'none' ? <p>Без налога (НДС): —</p> : <p>НДС {previewInv.vatType}%: {fmt(previewInv.vatAmount || 0)}</p>}
                  <p className="total-line">Всего к оплате: {fmt(previewInv.totalWithVat)}</p>
                </div>
                <div className="invoice-words">Всего наименований {(previewInv.positions || []).length}, на сумму {fmt(previewInv.totalWithVat)} руб.<br />{numberToWords(Number(previewInv.totalWithVat))}</div>
                <div className="invoice-signatures">
                  <div className="signature-block"><div>Руководитель</div><div className="signature-line"><span className="signature-dash" /><span className="signature-name">{previewOrg?.director || ''}</span></div></div>
                  <div className="signature-block"><div>Бухгалтер</div><div className="signature-line"><span className="signature-dash" /><span className="signature-name">{previewOrg?.accountant || ''}</span></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showPathWarning && createPortal(
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPathWarning(false); }} style={{ zIndex: 9999 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, zIndex: 10000 }}>
            <div className="modal-header">
              <h3>Настройте папку загрузок</h3>
              <button className="modal-close" onClick={() => setShowPathWarning(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>Папка для скачивания не настроена.</p>
              <div className="form-group">
                <label>Путь к папке</label>
                <input value={downloadPath} onChange={(e) => setDownloadPath(e.target.value)} placeholder="Например: ~/Documents/Счета" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowPathWarning(false); showToast('Файлы будут в «Загрузках»', 'info'); }}>Оставить по умолчанию</button>
              <button className="btn btn-primary" onClick={() => { if (downloadPath) { api.getActiveOrganization().then(r => { if (r.organization) api.updateOrganization(r.organization.id, { downloadPath }); }).catch(() => {}); showToast('Путь сохранён'); } setShowPathWarning(false); }}>Сохранить</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
