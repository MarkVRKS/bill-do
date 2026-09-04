// Local document generation for offline mobile use
import * as XLSX from 'xlsx';
import { invGetOne } from './local-db';
import { orgGetActive } from './local-db';
import { cpGetAll } from './local-db';

function fmt(n: number | string): string {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n));
}

function esc(s: string): string {
  return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
}

function numberToWords(num: number): string {
  if (num === 0) return 'Ноль рублей 00 копеек';
  const ones = ['','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
  const onesF = ['','одна','две','три','четыре','пять','шесть','семь','восемь','девять'];
  const teens = ['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const tensA = ['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
  const hundreds = ['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
  function grp(n: number, f: boolean) { let r = ''; if (n >= 100) { r += hundreds[Math.floor(n / 100)] + ' '; n %= 100; } if (n >= 20) { r += tensA[Math.floor(n / 10)] + ' '; n %= 10; } else if (n >= 10) return r + teens[n - 10] + ' '; if (n > 0) r += (f ? onesF : ones)[n] + ' '; return r; }
  function rubF(n: number) { const l2 = n % 100, l1 = n % 10; if (l2 >= 11 && l2 <= 19) return 'рублей'; if (l1 === 1) return 'рубль'; if (l1 >= 2 && l1 <= 4) return 'рубля'; return 'рублей'; }
  function kopF(n: number) { if (n === 0) return 'копеек'; const l2 = n % 100, l1 = n % 10; if (l2 >= 11 && l2 <= 19) return 'копеек'; if (l1 === 1) return 'копейка'; if (l1 >= 2 && l1 <= 4) return 'копейки'; return 'копеек'; }
  function intF(n: number, w: string, f1: string, f23: string, f5: string) { if (n === 0) return ''; const l2 = n % 100, l1 = n % 10; let s = f5; if (l2 >= 11 && l2 <= 19) s = f5; else if (l1 === 1) s = f1; else if (l1 >= 2 && l1 <= 4) s = f23; return grp(n >= 1000 ? n % 1000 : n, w === 'тысяч') + w + s + ' '; }
  const rub = Math.floor(num), kop = Math.round((num - rub) * 100); let r = '';
  if (rub >= 1e9) r += intF(Math.floor(rub / 1e9), 'миллиард', '', 'а', 'ов');
  if (rub >= 1e6) r += intF(Math.floor((rub % 1e9) / 1e6), 'миллион', '', 'а', 'ов');
  if (rub >= 1e3) r += intF(Math.floor((rub % 1e6) / 1e3), 'тысяч', 'а', 'и', '');
  const rem = rub % 1000; if (rem > 0 || rub === 0) r += grp(rem, false);
  r = r.trim() + ' ' + rubF(rub); r += ' ' + kop.toString().padStart(2, '0') + ' ' + kopF(kop); return r.charAt(0).toUpperCase() + r.slice(1);
}

const MONTHS_GEN = ['', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export async function generateInvoiceHtml(invoiceId: string): Promise<string> {
  const { invoice } = await invGetOne(invoiceId);
  if (!invoice) throw new Error('Счёт не найден');
  const { organization: org } = await orgGetActive();
  const { counterparties } = await cpGetAll();
  const cp = counterparties.find((c: any) => c.id === invoice.counterpartyId);

  const supplierLine = `${org?.name || ''}, ИНН ${org?.inn || ''}, КПП ${org?.kpp || ''}, ${org?.address || ''}`;
  const buyerLine = cp ? `${cp.name}, ${cp.address || ''}${cp.ogrn ? ', ОГРН ' + cp.ogrn : ''}, ИНН/КПП ${cp.inn || '—'}/${cp.kpp || '—'}` : '—';
  const basisPreview = (invoice.bases || []).filter((b: string) => b.trim()).join('; ') || '—';

  const totalSum = Number(invoice.total);
  const vatAmount = Number(invoice.vatAmount);
  const totalWithVat = Number(invoice.totalWithVat);

  const positions = invoice.positions || [];

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Счёт №${invoice.number}</title>
<style>
body{font-family:'Times New Roman',serif;font-size:10.5pt;color:#000;line-height:1.25;padding:12mm 14mm;margin:0}
table{border-collapse:collapse}
td,th{padding:3px 5px}
.bank-block{border:1px solid #000;margin-bottom:10px;font-size:9.5pt;line-height:1.3}
.bank-block td{border:1px solid #000}
.bl{font-weight:normal}.bv,.bacc{font-weight:bold}
.party-row{display:flex;margin-bottom:4px;font-size:9.5pt}
.party-label{font-weight:normal;min-width:100px}
.party-value{font-weight:bold}
.basis-block{margin-bottom:8px;font-size:9.5pt}
.invoice-table{width:100%;border-collapse:collapse;font-size:9.5pt;border:2px solid #000}
.invoice-table th,.invoice-table td{border:1px solid #000;padding:4px 6px}
.invoice-table th{font-weight:bold;text-align:center;background:#D6EDFF}
.totals{text-align:right;margin-bottom:8px;font-size:9.5pt}
.total-line{font-weight:bold;font-size:11pt;border-top:1px solid #000;padding-top:4px;margin-top:4px}
.words{margin:8px 0;font-size:9.5pt}
.signatures{display:flex;justify-content:space-between;margin-top:18px;font-size:9.5pt}
.sig-block{width:48%}
.sig-line{display:flex;align-items:center;gap:6px;margin-top:22px}
.sig-dash{flex:1;border-bottom:1px solid #000}
h1{font-size:14pt;margin:0 0 10px}
</style></head><body>
<h1>Счёт на оплату № ${esc(invoice.number)} от ${invoice.date?.split('-').reverse().join('.')} г.</h1>
<div class="bank-block"><table style="width:100%">
<tr><td class="bl" style="width:18%">Банк получателя</td><td class="bacc" colspan="3">${esc(org?.bankName || '')}</td></tr>
<tr><td class="bl">БИК</td><td class="bv">${esc(org?.bankBik || '')}</td><td class="bl">Сч. №</td><td class="bv">${esc(org?.bankCorr || '')}</td></tr>
<tr><td class="bl">ИНН</td><td class="bv">${esc(org?.inn || '')}</td><td class="bl">КПП</td><td class="bv">${esc(org?.kpp || '')}</td></tr>
<tr><td class="bl">Сч. №</td><td class="bacc" colspan="3">${esc(org?.bankAccount || '')}</td></tr>
<tr><td class="bl">Получатель</td><td class="bacc" colspan="3">${esc(org?.name || '')}</td></tr>
</table></div>
<div class="party-row"><span class="party-label">Поставщик:</span><span class="party-value">${esc(supplierLine)}</span></div>
<div class="party-row"><span class="party-label">Покупатель:</span><span class="party-value">${esc(buyerLine)}</span></div>
<div class="basis-block">Основание: ${esc(basisPreview)}</div>
<table class="invoice-table">
<thead><tr><th style="width:5%">№</th><th style="width:53%">Товары (работы, услуги)</th><th style="width:7%">Кол-во</th><th style="width:7%">Ед.</th><th style="width:12%">Цена</th><th style="width:12%">Сумма</th></tr></thead>
<tbody>${positions.map((p: any, i: number) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(p.name)}</td><td style="text-align:center">${p.quantity}</td><td style="text-align:center">${esc(p.unit)}</td><td style="text-align:right">${fmt(p.price)}</td><td style="text-align:right">${fmt(p.amount)}</td></tr>`).join('')}</tbody>
</table>
<div class="totals">
<p>Итого: ${fmt(totalSum)}</p>
${invoice.vatType === 'none' ? '<p>Без налога (НДС): —</p>' : `<p>НДС ${invoice.vatType}%: ${fmt(vatAmount)}</p>`}
<p class="total-line">Всего к оплате: ${fmt(totalWithVat)}</p>
</div>
<div class="words">Всего наименований ${positions.length}, на сумму ${fmt(totalWithVat)} руб.<br>${numberToWords(totalWithVat)}</div>
<div class="signatures">
<div class="sig-block"><div>Руководитель</div><div class="sig-line"><span class="sig-dash"/><span>${esc(org?.director || '')}</span></div></div>
<div class="sig-block"><div>Бухгалтер</div><div class="sig-line"><span class="sig-dash"/><span>${esc(org?.accountant || '')}</span></div></div>
</div>
</body></html>`;
}

export async function generateActHtml(invoiceId: string): Promise<string> {
  const { invoice } = await invGetOne(invoiceId);
  if (!invoice) throw new Error('Счёт не найден');
  const { organization: org } = await orgGetActive();
  const { counterparties } = await cpGetAll();
  const cp = counterparties.find((c: any) => c.id === invoice.counterpartyId);

  const positions = invoice.positions || [];
  const totalWithVat = Number(invoice.totalWithVat);
  const monthName = MONTHS_GEN[invoice.serviceMonth] || '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Акт №${invoice.number}</title>
<style>
body{font-family:'Times New Roman',serif;font-size:11pt;color:#000;line-height:1.4;padding:15mm 20mm;margin:0}
table{border-collapse:collapse;width:100%}
td,th{padding:4px 6px;border:1px solid #000}
th{font-weight:bold;text-align:center;background:#D6EDFF}
.title{font-size:16pt;font-weight:bold;text-align:center;margin:0 0 4px}
.subtitle{font-size:12pt;text-align:center;margin:0 0 16px}
.parties{margin:0 0 14px;font-size:10.5pt;line-height:1.5}
.parties b{font-weight:600}
.table-wrap{margin:0 0 10px}
.totals-wrap{display:flex;justify-content:flex-end;margin:0 0 10px}
.totals-inner{text-align:right;font-size:10.5pt}
.totals-inner p{margin:2px 0}
.total-line{font-weight:bold;font-size:11pt;border-top:2px solid #000;padding-top:4px;margin-top:4px}
.closing{margin:14px 0 0;font-size:10.5pt;line-height:1.5}
.sig-row{display:flex;justify-content:space-between;margin-top:30px;font-size:10.5pt}
.sig-col{width:45%}
.sig-title{font-weight:bold;margin:0 0 4px}
.sig-line-row{display:flex;align-items:baseline;gap:6px;margin-top:28px}
.sig-label{white-space:nowrap}
.sig-dash{flex:1;border-bottom:1px solid #000;min-width:100px}
.sig-name{white-space:nowrap}
</style></head><body>
<div class="title">АКТ</div>
<div class="subtitle">оказанных услуг № ${esc(invoice.number)} от ${invoice.date?.split('-').reverse().join('.')} г.</div>

<div class="parties">
${esc(org?.name || '')}${org?.director ? ', в лице ' + esc(org.director) : ''}${org?.inn ? ', ИНН ' + esc(org.inn) : ''}${org?.address ? ', ' + esc(org.address) : ''}, именуемое в дальнейшем <b>«Исполнитель»</b>, с одной стороны,
и ${cp ? esc(cp.name) : '—'}${cp?.address ? ', ' + esc(cp.address) : ''}${cp?.inn ? ', ИНН ' + esc(cp.inn) : ''}, именуемое в дальнейшем <b>«Заказчик»</b>, с другой стороны,
составили настоящий акт о том, что за <b>${monthName} ${invoice.serviceYear} г.</b> Исполнителем были оказаны следующие услуги:
</div>

<div class="table-wrap">
<table>
<thead><tr><th style="width:5%">№</th><th style="width:50%">Наименование услуги</th><th style="width:7%">Кол-во</th><th style="width:8%">Ед.</th><th style="width:14%">Цена</th><th style="width:16%">Сумма</th></tr></thead>
<tbody>${positions.map((p: any, i: number) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(p.name)}</td><td style="text-align:center">${p.quantity}</td><td style="text-align:center">${esc(p.unit)}</td><td style="text-align:right">${fmt(p.price)}</td><td style="text-align:right">${fmt(p.amount)}</td></tr>`).join('')}</tbody>
</table>
</div>

<div class="totals-wrap"><div class="totals-inner">
<p>Итого: ${fmt(totalWithVat)} руб.</p>
<p class="total-line">Всего к оплате: ${fmt(totalWithVat)} руб.</p>
</div></div>

<div class="closing">
Вышеперечисленные услуги выполнены полностью и в надлежащем качестве, в установленные сроки. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.
</div>

<div class="sig-row">
<div class="sig-col">
<div class="sig-title">ИСПОЛНИТЕЛЬ</div>
<div class="sig-line-row"><span class="sig-label">Подпись:</span><span class="sig-dash"></span></div>
<div class="sig-line-row"><span class="sig-label">ФИО:</span><span class="sig-dash"><span class="sig-name">${esc(org?.director || '')}</span></span></div>
<div class="sig-line-row"><span class="sig-label">М.П.</span></div>
</div>
<div class="sig-col">
<div class="sig-title">ЗАКАЗЧИК</div>
<div class="sig-line-row"><span class="sig-label">Подпись:</span><span class="sig-dash"></span></div>
<div class="sig-line-row"><span class="sig-label">ФИО:</span><span class="sig-dash"></span></div>
<div class="sig-line-row"><span class="sig-label">М.П.</span></div>
</div>
</div>
</body></html>`;
}

export async function generateInvoiceExcel(invoiceId: string): Promise<Blob> {
  const { invoice } = await invGetOne(invoiceId);
  if (!invoice) throw new Error('Счёт не найден');
  const { organization: org } = await orgGetActive();
  const { counterparties } = await cpGetAll();
  const cp = counterparties.find((c: any) => c.id === invoice.counterpartyId);

  const positions = invoice.positions || [];
  const totalSum = Number(invoice.total);
  const vatAmount = Number(invoice.vatAmount);
  const totalWithVat = Number(invoice.totalWithVat);

  const wb = XLSX.utils.book_new();
  const data = [
    ['Счёт на оплату №', invoice.number, 'от', invoice.date?.split('-').reverse().join('.')],
    [],
    ['Банк получателя', org?.bankName || ''],
    ['БИК', org?.bankBik || '', 'Сч. №', org?.bankCorr || ''],
    ['ИНН', org?.inn || '', 'КПП', org?.kpp || ''],
    ['Сч. №', org?.bankAccount || ''],
    ['Получатель', org?.name || ''],
    [],
    ['Поставщик', `${org?.name || ''}, ИНН ${org?.inn || ''}, ${org?.address || ''}`],
    ['Покупатель', cp ? `${cp.name}, ${cp.address || ''}` : '—'],
    ['Основание', (invoice.bases || []).filter((b: string) => b.trim()).join('; ') || '—'],
    [],
    ['№', 'Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма'],
    ...positions.map((p: any, i: number) => [i + 1, p.name, p.quantity, p.unit, Number(p.price), Number(p.amount)]),
    [],
    ['', '', '', '', 'Итого:', totalSum],
    ['', '', '', '', `НДС ${invoice.vatType === 'none' ? '' : invoice.vatType + '%'}:`, invoice.vatType === 'none' ? '—' : vatAmount],
    ['', '', '', '', 'Всего:', totalWithVat],
    [],
    [numberToWords(totalWithVat)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 5 }, { wch: 50 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Счёт');

  const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function generateActExcel(invoiceId: string): Promise<Blob> {
  const { invoice } = await invGetOne(invoiceId);
  if (!invoice) throw new Error('Счёт не найден');
  const { organization: org } = await orgGetActive();
  const { counterparties } = await cpGetAll();
  const cp = counterparties.find((c: any) => c.id === invoice.counterpartyId);

  const positions = invoice.positions || [];
  const totalWithVat = Number(invoice.totalWithVat);
  const monthName = MONTHS_GEN[invoice.serviceMonth] || '';

  const wb = XLSX.utils.book_new();
  const data = [
    ['Акт оказанных услуг №', invoice.number, 'от', invoice.date?.split('-').reverse().join('.')],
    [],
    ['Исполнитель', org?.name || ''],
    ['Заказчик', cp?.name || ''],
    ['Период', `${monthName} ${invoice.serviceYear} г.`],
    [],
    ['№', 'Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма'],
    ...positions.map((p: any, i: number) => [i + 1, p.name, p.quantity, p.unit, Number(p.price), Number(p.amount)]),
    [],
    ['', '', '', '', 'Итого:', totalWithVat],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 5 }, { wch: 50 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Акт');

  const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function downloadBlob(blob: Blob, filename: string) {
  // Try Capacitor Share for mobile
  try {
    const { Share } = await import('@capacitor/share');
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    // Convert blob to base64
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    // Write to cache directory
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });

    // Share the file (this opens the system share sheet which allows saving)
    await Share.share({
      title: filename,
      url: result.uri,
    });
    return;
  } catch {
    // Fallback to browser download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
}

export async function shareHtml(html: string, filename: string) {
  // Save HTML as file and share it (works on mobile without opening new window)
  try {
    const { Share } = await import('@capacitor/share');
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    const base64 = btoa(unescape(encodeURIComponent(html)));
    const result = await Filesystem.writeFile({
      path: filename + '.html',
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: filename,
      url: result.uri,
    });
  } catch {
    // Fallback for desktop: open in new window
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  }
}
