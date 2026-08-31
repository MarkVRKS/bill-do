import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useInvoiceStore } from '../stores/invoiceStore';

const MONTHS_GENITIVE = ['', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function TooltipButton({ children, tooltip, onClick, className, style }: {
  children: React.ReactNode; tooltip: string; onClick?: () => void; className?: string; style?: React.CSSProperties;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="tooltip-wrap" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} style={{ position: 'relative', display: 'inline-flex', flex: 1 }}>
      <button className={className} onClick={onClick} style={{ ...style, width: '100%' }}>{children}</button>
      {show && <div className="tooltip-bubble">{tooltip}</div>}
    </div>
  );
}

function esc(s: string) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
function fmt(n: number | string) { return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n)); }

function numberToWords(num: number): string {
  if (num === 0) return 'Ноль рублей 00 копеек';
  const ones = ['','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
  const onesF = ['','одна','две','три','четыре','пять','шесть','семь','восемь','девять'];
  const teens = ['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const tensA = ['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
  const hundreds = ['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
  function grp(n:number,f:boolean){let r='';if(n>=100){r+=hundreds[Math.floor(n/100)]+' ';n%=100}if(n>=20){r+=tensA[Math.floor(n/10)]+' ';n%=10}else if(n>=10)return r+teens[n-10]+' ';if(n>0)r+=(f?onesF:ones)[n]+' ';return r}
  function rubF(n:number){const l2=n%100,l1=n%10;if(l2>=11&&l2<=19)return'рублей';if(l1===1)return'рубль';if(l1>=2&&l1<=4)return'рубля';return'рублей'}
  function kopF(n:number){if(n===0)return'копеек';const l2=n%100,l1=n%10;if(l2>=11&&l2<=19)return'копеек';if(l1===1)return'копейка';if(l1>=2&&l1<=4)return'копейки';return'копеек'}
  function intF(n:number,w:string,f1:string,f23:string,f5:string){if(n===0)return'';const l2=n%100,l1=n%10;let s=f5;if(l2>=11&&l2<=19)s=f5;else if(l1===1)s=f1;else if(l1>=2&&l1<=4)s=f23;return grp(n>=1000?n%1000:n,w==='тысяч')+w+s+' '}
  const rub=Math.floor(num),kop=Math.round((num-rub)*100);let r='';
  if(rub>=1000000000)r+=intF(Math.floor(rub/1000000000),'миллиард','','а','ов');
  if(rub>=1000000)r+=intF(Math.floor((rub%1000000000)/1000000),'миллион','','а','ов');
  if(rub>=1000)r+=intF(Math.floor((rub%1000000)/1000),'тысяч','а','и','');
  const rem=rub%1000;if(rem>0||rub===0)r+=grp(rem,false);
  r=r.trim()+' '+rubF(rub);r+=' '+kop.toString().padStart(2,'0')+' '+kopF(kop);return r.charAt(0).toUpperCase()+r.slice(1);
}

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
            placeholder="номер и договора, напр. Договор №123 от 01.01.2026"
            autoFocus={!value}
          />
        </div>
      )}
    </div>
  );
}

export function InvoicePage() {
  const { id } = useParams();
  const store = useInvoiceStore();
  const [counterparties, setCounterparties] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [showCpModal, setShowCpModal] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [cpForm, setCpForm] = useState({ name:'', address:'', ogrn:'', inn:'', kpp:'', bases: [''] });
  const [showPathWarning, setShowPathWarning] = useState(false);
  const [tempDownloadPath, setTempDownloadPath] = useState('');
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    loadData();
  }, [id]);

  // Auto-save draft on every change (debounced)
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      store.saveDraft();
    }, 500);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [store.number, store.date, store.counterpartyId, store.bases, store.serviceMonth, store.serviceYear, store.vatType, store.positions]);

  async function loadData() {
    try {
      const [cpRes, orgRes] = await Promise.all([api.getCounterparties(), api.getActiveOrganization()]);
      setCounterparties(cpRes.counterparties);
      setOrg(orgRes.organization);
      if (id) {
        const inv = await api.getInvoice(id);
        store.loadInvoice(inv.invoice);
      } else if (!store.loadDraft()) {
        store.reset();
        store.getNextNumber();
      }
    } catch {}
    isInitialLoad.current = false;
  }

  function showToast(msg: string, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // When counterparty changes, load bases from settings
  const handleCounterpartyChange = useCallback((cpId: string | null) => {
    store.setField('counterpartyId', cpId);
    if (cpId) {
      const cp = counterparties.find((c) => c.id === cpId);
      if (cp) {
        const cpBases = Array.isArray(cp.bases) && cp.bases.length > 0
          ? cp.bases
          : cp.basis ? [cp.basis] : [];
        store.loadBasesFromCounterparty(cpBases);
      }
    }
  }, [counterparties, store]);

  async function handleSave() {
    if (!store.counterpartyId) { showToast('Выберите покупателя', 'error'); return; }
    const total = store.positions.reduce((s, p) => s + p.quantity * p.price, 0);
    if (total <= 0) { showToast('Сумма должна быть больше нуля', 'error'); return; }

    const filteredBases = store.bases.filter(b => b.trim());

    const data = {
      number: store.number,
      date: store.date,
      counterpartyId: store.counterpartyId,
      bases: filteredBases,
      serviceMonth: store.serviceMonth,
      serviceYear: store.serviceYear,
      vatType: store.vatType,
      status: 'sent',
      positions: store.positions.map((p) => ({
        name: p.name, quantity: p.quantity, unit: p.unit, price: p.price,
      })),
    };

    try {
      if (store.editingId) {
        await api.updateInvoice(store.editingId, data);
        showToast('Счёт обновлён');
        store.setField('lastSavedId', store.editingId);
      } else {
        const res = await api.createInvoice(data) as any;
        showToast('Счёт сохранён');
        store.setField('editingId', res.invoice.id);
        store.setField('lastSavedId', res.invoice.id);
        localStorage.removeItem('invoice_draft');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  function handleNewInvoice() {
    store.reset();
    store.getNextNumber();
    localStorage.removeItem('invoice_draft');
  }

  function getFilename(type: 'invoice' | 'act'): string {
    const cp = counterparties.find((c) => c.id === store.counterpartyId);
    const MONTHS_NOM = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const prefix = type === 'invoice' ? 'Счет_на_оплату' : 'Акт_оказанных_услуг';
    const safeLf = (org?.legalForm || '').replace(/[^а-яА-Яa-zA-Z]/g, '');
    const safeCp = (cp?.name || 'без_покупателя').replace(/[^а-яА-Яa-zA-Z0-9]/g, '_');
    const monthName = MONTHS_NOM[store.serviceMonth] || '';
    return `${prefix}_№${store.number}_${safeLf}_${safeCp}_${monthName}_${store.serviceYear}`;
  }

  async function fetchAndSave(url: string, filename: string) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Ошибка скачивания');
    const blob = await res.blob();
    if ((window as any).electronAPI?.isElectron) {
      const buf = await blob.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      await (window as any).electronAPI.saveFile(org?.downloadPath || '', filename, b64);
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }
  }

  async function fetchHtmlAndGeneratePdf(htmlUrl: string, filename: string) {
    const res = await fetch(htmlUrl, { credentials: 'include' });
    if (!res.ok) throw new Error('Ошибка загрузки');
    const html = await res.text();
    if ((window as any).electronAPI?.isElectron) {
      const r = await (window as any).electronAPI.generatePdf(html, filename + '.pdf', org?.downloadPath || '');
      if (!r.success) throw new Error(r.error || 'Ошибка PDF');
    } else {
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    }
  }

  async function fetchHtmlAndPrint(htmlUrl: string, type: 'invoice' | 'act') {
    const res = await fetch(htmlUrl, { credentials: 'include' });
    if (!res.ok) throw new Error('Ошибка загрузки');
    const html = await res.text();
    const filename = getFilename(type);
    if ((window as any).electronAPI?.isElectron) {
      // Use printHtml IPC to open print dialog directly
      const r = await (window as any).electronAPI.printHtml(html, filename);
      if (!r.success) throw new Error(r.error || 'Ошибка печати');
    } else {
      const w = window.open('', '_blank', 'width=900,height=700');
      if (w) { w.document.write(html); w.document.close(); w.onload = () => w.print(); }
    }
  }

  function handleDownloadExcel() {
    const id = store.lastSavedId || store.editingId;
    if (id) { showToast('Скачивание Excel...', 'info'); fetchAndSave(api.getExcelUrl(id), getFilename('invoice') + '.xlsx').then(() => showToast('Excel скачан', 'success')).catch(e => showToast(e.message, 'error')); }
  }

  function handleDownloadPdf() {
    const id = store.lastSavedId || store.editingId;
    if (id) { showToast('Генерация PDF...', 'info'); fetchHtmlAndGeneratePdf(api.getPdfUrl(id), getFilename('invoice')).then(() => showToast('PDF создан!', 'success')).catch(e => showToast(e.message, 'error')); }
  }

  function handleDownloadAct() {
    const id = store.lastSavedId || store.editingId;
    if (id) { showToast('Скачивание акта Excel...', 'info'); fetchAndSave(api.getActUrl(id), getFilename('act') + '.xlsx').then(() => showToast('Excel скачан', 'success')).catch(e => showToast(e.message, 'error')); }
  }

  function handleDownloadActPdf() {
    const id = store.lastSavedId || store.editingId;
    if (id) { showToast('Генерация PDF акта...', 'info'); fetchHtmlAndGeneratePdf(api.getActPdfUrl(id), getFilename('act')).then(() => showToast('PDF акта создан!', 'success')).catch(e => showToast(e.message, 'error')); }
  }

  function handlePrint() {
    const id = store.lastSavedId || store.editingId;
    if (id) { showToast('Подготовка печати...', 'info'); fetchHtmlAndPrint(api.getPrintUrl(id), 'invoice').catch(e => showToast(e.message || 'Ошибка печати', 'error')); }
  }

  function handlePrintAct() {
    const id = store.lastSavedId || store.editingId;
    if (id) { showToast('Подготовка печати...', 'info'); fetchHtmlAndPrint(api.getActPrintUrl(id), 'act').catch(e => showToast(e.message || 'Ошибка печати', 'error')); }
  }

  async function handleSaveCp() {
    if (!cpForm.name) { showToast('Введите название', 'error'); return; }
    try {
      const res = await api.createCounterparty(cpForm) as any;
      setCounterparties([...counterparties, res.counterparty]);
      setShowCpModal(false);
      setCpForm({ name:'', address:'', ogrn:'', inn:'', kpp:'', bases: [''] });
      showToast('Покупатель добавлен');
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  // Preview calculation
  const totalSum = store.positions.reduce((s, p) => s + p.quantity * p.price, 0);
  let vatAmount = 0, totalWithVat = totalSum;
  if (store.vatType === '20') { vatAmount = Math.round(totalSum * 0.2 * 100) / 100; totalWithVat = Math.round((totalSum + vatAmount) * 100) / 100; }
  else if (store.vatType === '22') { vatAmount = Math.round(totalSum * 0.22 * 100) / 100; totalWithVat = Math.round((totalSum + vatAmount) * 100) / 100; }
  else if (store.vatType === '10') { vatAmount = Math.round(totalSum * 0.1 * 100) / 100; totalWithVat = Math.round((totalSum + vatAmount) * 100) / 100; }

  const cp = counterparties.find((c) => c.id === store.counterpartyId);
  const supplierLine = `${org?.name || ''}, ИНН ${org?.inn || ''}, КПП ${org?.kpp || ''}, ${org?.address || ''}`;
  const buyerLine = cp ? `${cp.name}, ${cp.address || ''}${cp.ogrn ? ', ОГРН '+cp.ogrn : ''}, ИНН/КПП ${cp.inn || '—'}/${cp.kpp || '—'}` : '—';
  const basisPreview = store.bases.filter(b => b.trim()).join('; ') || '—';
  const hasSavedInvoice = !!(store.lastSavedId || store.editingId);

  return (
    <>
      <div className="page-hero">
        <h1>Счёт на оплату <em>за минуту.</em></h1>
        <div className="page-hero-sub">Заполните данные слева — документ соберётся справа</div>
      </div>

      <div className={`form-grid ${!previewOpen ? 'preview-collapsed' : ''}`}>
        <div>
          <div className="card">
            <div className="card-header"><h3>Основные данные</h3></div>
            <div className="form-row">
              <div className="form-group">
                <label>Номер счёта</label>
                <input id="invoiceNumber" type="number" value={store.number} onChange={(e) => store.setField('number', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Дата счёта</label>
                <input id="invoiceDate" type="date" value={store.date} onChange={(e) => store.setField('date', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Покупатель</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select id="counterparty" value={store.counterpartyId || ''} onChange={(e) => handleCounterpartyChange(e.target.value || null)} style={{ flex: 1 }}>
                  <option value="">— Выберите покупателя —</option>
                  {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                </select>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowCpModal(true)}>Добавить</button>
              </div>
            </div>

            {/* Multiple bases section */}
            <div className="form-group">
              <label>Основания (договоры)</label>
              <div className="bases-list">
                {store.bases.map((basis, i) => (
                  <BasisItem
                    key={i}
                    value={basis}
                    index={i}
                    onChange={(val) => store.updateBasis(i, val)}
                    onRemove={() => store.removeBasis(i)}
                    canRemove={store.bases.length > 1}
                  />
                ))}
              </div>
              <button className="btn btn-sm btn-secondary basis-add-btn" onClick={() => store.addBasis()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                Добавить основание
              </button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Месяц оказания услуг</label>
                <select value={store.serviceMonth} onChange={(e) => store.setField('serviceMonth', parseInt(e.target.value))}>
                  {MONTHS_GENITIVE.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Год оказания услуг</label>
                <input type="number" value={store.serviceYear} onChange={(e) => store.setField('serviceYear', parseInt(e.target.value))} />
              </div>
            </div>
            <div className="form-group">
              <label>НДС</label>
              <select id="vatType" value={store.vatType} onChange={(e) => store.setField('vatType', e.target.value)}>
                <option value="none">Без НДС</option>
                <option value="0">НДС 0%</option>
                <option value="10">НДС 10%</option>
                <option value="20">НДС 20%</option>
                <option value="22">НДС 22%</option>
              </select>
            </div>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <div className="card-header" style={{ marginBottom: '1.75rem', paddingBottom: '1.25rem' }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Позиции счёта</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>Добавьте услуги и укажите стоимость</p>
              </div>
              <button className="btn btn-secondary" onClick={() => store.addPosition()}>+ Добавить позицию</button>
            </div>
            <div id="positionsBody" className="positions-list">
              {store.positions.map((pos, i) => (
                <div key={pos.id} className="position-card">
                  <div className="position-card-header">
                    <div className="position-number">{i + 1}</div>
                    <div className="position-card-title">Позиция {i + 1}</div>
                    {store.positions.length > 1 && (
                      <button className="position-delete" onClick={() => store.removePosition(pos.id)}>×</button>
                    )}
                  </div>
                  <div className="position-name-group">
                    <label>Наименование услуги</label>
                    <textarea rows={2} value={pos.name} onChange={(e) => store.updatePosition(pos.id, 'name', e.target.value)} placeholder="Опишите услугу..." />
                  </div>
                  <div className="position-fields">
                    <div className="position-field">
                      <label>Количество</label>
                      <input type="number" value={pos.quantity || ''} min={0} placeholder="0" onChange={(e) => store.updatePosition(pos.id, 'quantity', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="position-field">
                      <label>Ед. измерения</label>
                      <input type="text" value={pos.unit} onChange={(e) => store.updatePosition(pos.id, 'unit', e.target.value)} />
                    </div>
                    <div className="position-field">
                      <label>Цена за ед.</label>
                      <input type="number" value={pos.price || ''} min={0} step={0.01} placeholder="0" onChange={(e) => store.updatePosition(pos.id, 'price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="position-field sum-field">
                      <label>Сумма</label>
                      <input type="text" value={fmt(pos.quantity * pos.price)} readOnly />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="actions-bar" style={{ flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%' }}>
                {store.editingId ? 'Обновить счёт' : 'Сохранить и продолжить'}
              </button>
              {hasSavedInvoice && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
                    <TooltipButton tooltip="Создать счёт в Excel" className="btn btn-secondary" onClick={handleDownloadExcel}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                      Создать счёт в Excel
                    </TooltipButton>
                    <TooltipButton tooltip="Создать счёт в PDF" className="btn btn-secondary" onClick={handleDownloadPdf}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      Создать счёт в PDF
                    </TooltipButton>
                    <TooltipButton tooltip="Создать Акт в Excel" className="btn btn-secondary" onClick={handleDownloadAct}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                      Создать Акт в Excel
                    </TooltipButton>
                    <TooltipButton tooltip="Создать Акт в PDF" className="btn btn-secondary" onClick={handleDownloadActPdf}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      Создать Акт в PDF
                    </TooltipButton>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
                    <button className="btn btn-outline" onClick={handlePrint} style={{ width: '100%' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      Печать счёта
                    </button>
                    <button className="btn btn-outline" onClick={handlePrintAct} style={{ width: '100%' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      Печать акта
                    </button>
                  </div>
                  <button className="btn btn-secondary" onClick={handleNewInvoice} style={{ width: '100%' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    Создать новый счёт
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={`preview-section ${!previewOpen ? 'preview-hidden' : ''}`}>
          <div className="preview-header">
            <span className="preview-header-label">Предварительный просмотр</span>
            <button className="preview-toggle" onClick={() => setPreviewOpen(false)} title="Свернуть превью">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          </div>
          <div className="preview-content">
            <div className="invoice-preview">
              <div className="invoice-title">Счёт на оплату № {esc(store.number)} от {store.date ? store.date.split('-').reverse().join('.') : '—'} г.</div>
              <div className="bank-block">
                <table>
                  <tbody>
                    <tr><td className="bl" style={{width:'18%'}}>Банк получателя</td><td className="bacc" colSpan={3}>{esc(org?.bankName || '')}</td></tr>
                    <tr><td className="bl">БИК</td><td className="bv">{esc(org?.bankBik || '')}</td><td className="bl">Сч. №</td><td className="bv">{esc(org?.bankCorr || '')}</td></tr>
                    <tr><td className="bl">ИНН</td><td className="bv">{esc(org?.inn || '')}</td><td className="bl">КПП</td><td className="bv">{esc(org?.kpp || '')}</td></tr>
                    <tr><td className="bl">Сч. №</td><td className="bacc" colSpan={3}>{esc(org?.bankAccount || '')}</td></tr>
                    <tr><td className="bl">Получатель</td><td className="bacc" colSpan={3}>{esc(org?.name || '')}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="parties-block">
                <div className="party-row"><span className="party-label">Поставщик:</span><span className="party-value">{esc(supplierLine)}</span></div>
                <div className="party-row"><span className="party-label">Покупатель:</span><span className="party-value">{esc(buyerLine)}</span></div>
              </div>
              <div className="basis-block">Основание: {esc(basisPreview)}</div>
              <div className="invoice-table-wrap">
                <table className="invoice-table">
                  <thead><tr>
                    <th style={{width:'5%'}}>№</th><th style={{width:'53%'}}>Товары (работы, услуги)</th>
                    <th style={{width:'7%'}}>Кол-во</th><th style={{width:'7%'}}>Ед.</th>
                    <th style={{width:'12%'}}>Цена</th><th style={{width:'12%'}}>Сумма</th>
                  </tr></thead>
                  <tbody>
                    {store.positions.map((pos, i) => (
                      <tr key={pos.id}>
                        <td style={{textAlign:'center'}}>{i + 1}</td>
                        <td>{esc(pos.name)}</td>
                        <td style={{textAlign:'center'}}>{pos.quantity}</td>
                        <td style={{textAlign:'center'}}>{esc(pos.unit)}</td>
                        <td style={{textAlign:'right'}}>{fmt(pos.price)}</td>
                        <td style={{textAlign:'right'}}>{fmt(pos.quantity * pos.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="invoice-totals">
                <p>Итого: {fmt(totalSum)}</p>
                {store.vatType === 'none' ? <p>Без налога (НДС): —</p> : <p>НДС {store.vatType}%: {fmt(vatAmount)}</p>}
                <p className="total-line">Всего к оплате: {fmt(totalWithVat)}</p>
              </div>
              <div className="invoice-words">Всего наименований {store.positions.length}, на сумму {fmt(totalWithVat)} руб.<br />{numberToWords(totalWithVat)}</div>
              <div className="invoice-signatures">
                <div className="signature-block"><div>Руководитель</div><div className="signature-line"><span className="signature-dash" /><span className="signature-name">{esc(org?.director || '')}</span></div></div>
                <div className="signature-block"><div>Бухгалтер</div><div className="signature-line"><span className="signature-dash" /><span className="signature-name">{esc(org?.accountant || '')}</span></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!previewOpen && (
        <div className="preview-sidebar-tab" onClick={() => setPreviewOpen(true)} title="Показать превью">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          <span className="preview-sidebar-tab-text">Превью</span>
        </div>
      )}

      {showCpModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCpModal(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Добавить покупателя</h3>
              <button className="modal-close" onClick={() => setShowCpModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>Наименование *</label><textarea rows={1} value={cpForm.name} onChange={(e) => setCpForm({...cpForm, name: e.target.value})} style={{ minHeight: 44 }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} /></div>
              <div className="form-group"><label>Адрес</label><textarea rows={1} value={cpForm.address} onChange={(e) => setCpForm({...cpForm, address: e.target.value})} style={{ minHeight: 44 }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} /></div>
              <div className="form-row">
                <div className="form-group"><label>ИНН</label><input value={cpForm.inn} maxLength={12} onChange={(e) => setCpForm({...cpForm, inn: e.target.value})} /></div>
                <div className="form-group"><label>КПП</label><input value={cpForm.kpp} maxLength={9} onChange={(e) => setCpForm({...cpForm, kpp: e.target.value})} /></div>
              </div>
              <div className="form-group"><label>ОГРН</label><input value={cpForm.ogrn} maxLength={15} onChange={(e) => setCpForm({...cpForm, ogrn: e.target.value})} /></div>
              <div className="form-group">
                <label>Основания</label>
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
              <button className="btn btn-primary" onClick={handleSaveCp}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-container"><div className={`toast ${toast.type}`} onClick={() => setToast(null)}>{toast.msg}</div></div>}

      {/* Download path warning */}
      {showPathWarning && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPathWarning(false); }} style={{ zIndex: 9999 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, zIndex: 10000 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9A6C16" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Настройте папку загрузок
              </h3>
              <button className="modal-close" onClick={() => setShowPathWarning(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                Папка для скачивания счетов не настроена. Файлы будут скачиваться в папку «Загрузки» браузера.
              </p>
              <div className="form-group">
                <label>Путь к папке</label>
                <input value={tempDownloadPath} onChange={(e) => setTempDownloadPath(e.target.value)} placeholder="Например: ~/Documents/Счета" />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {['~/Documents/Счета', '~/Документы/Счета', '~/Downloads/Invoices'].map(p => (
                  <button key={p} className="btn btn-sm btn-secondary" onClick={() => setTempDownloadPath(p)} style={{ fontSize: 12 }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowPathWarning(false); showToast('Файлы будут в «Загрузках»', 'info'); }}>
                Оставить по умолчанию
              </button>
              <button className="btn btn-primary" onClick={() => {
                if (tempDownloadPath && org) {
                  api.updateOrganization(org.id, { downloadPath: tempDownloadPath });
                  setOrg({ ...org, downloadPath: tempDownloadPath });
                  showToast('Путь сохранён', 'success');
                }
                setShowPathWarning(false);
              }}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
