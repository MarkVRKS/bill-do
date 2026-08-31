interface Position {
  sortOrder: number;
  name: string;
  quantity: string;
  unit: string;
  price: string;
  amount: string;
}

interface Organization {
  name: string;
  inn: string;
  kpp: string;
  address: string;
  director: string;
  accountant: string;
  bankName?: string;
  bankBik?: string;
  bankCorr?: string;
  bankAccount?: string;
}

interface Counterparty {
  name: string;
  address: string;
  ogrn: string;
  inn: string;
  kpp: string;
}

interface InvoiceData {
  number: string;
  date: string;
  basis: string;
  serviceMonth: number;
  serviceYear: number;
  vatType: string;
  total: string;
  vatAmount: string;
  totalWithVat: string;
  positions: Position[];
}

interface ActData {
  number: string;
  date: string;
  bases: string[];
  serviceMonth: number;
  serviceYear: number;
  vatType: string;
  total: string;
  vatAmount: string;
  totalWithVat: string;
  positions: Position[];
}

function formatRuDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function formatNumber(num: string | number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(num));
}

function numberToWords(num: number): string {
  if (num === 0) return 'Ноль рублей 00 копеек';

  const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const onesF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tensArr = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

  function group(n: number, fem: boolean): string {
    let r = '';
    if (n >= 100) { r += hundreds[Math.floor(n / 100)] + ' '; n %= 100; }
    if (n >= 20) { r += tensArr[Math.floor(n / 10)] + ' '; n %= 10; }
    else if (n >= 10) return r + teens[n - 10] + ' ';
    if (n > 0) r += (fem ? onesF : ones)[n] + ' ';
    return r;
  }

  function rubForm(n: number): string {
    const l2 = n % 100, l1 = n % 10;
    if (l2 >= 11 && l2 <= 19) return 'рублей';
    if (l1 === 1) return 'рубль';
    if (l1 >= 2 && l1 <= 4) return 'рубля';
    return 'рублей';
  }

  function kopForm(n: number): string {
    if (n === 0) return 'копеек';
    const l2 = n % 100, l1 = n % 10;
    if (l2 >= 11 && l2 <= 19) return 'копеек';
    if (l1 === 1) return 'копейка';
    if (l1 >= 2 && l1 <= 4) return 'копейки';
    return 'копеек';
  }

  function intForm(n: number, word: string, f1: string, f23: string, f5: string): string {
    if (n === 0) return '';
    const l2 = n % 100, l1 = n % 10;
    let s = f5;
    if (l2 >= 11 && l2 <= 19) s = f5;
    else if (l1 === 1) s = f1;
    else if (l1 >= 2 && l1 <= 4) s = f23;
    return group(n >= 1000 ? n % 1000 : n, word === 'тысяч') + word + s + ' ';
  }

  const rub = Math.floor(num);
  const kop = Math.round((num - rub) * 100);
  let result = '';

  if (rub >= 1000000000) result += intForm(Math.floor(rub / 1000000000), 'миллиард', '', 'а', 'ов');
  if (rub >= 1000000) result += intForm(Math.floor((rub % 1000000000) / 1000000), 'миллион', '', 'а', 'ов');
  if (rub >= 1000) result += intForm(Math.floor((rub % 1000000) / 1000), 'тысяч', 'а', 'и', '');

  const rem = rub % 1000;
  if (rem > 0 || rub === 0) result += group(rem, false);

  result = result.trim() + ' ' + rubForm(rub);
  result += ' ' + kop.toString().padStart(2, '0') + ' ' + kopForm(kop);
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generatePrintHTML(
  org: Organization,
  cp: Counterparty | null,
  invoice: InvoiceData
): string {
  const supplierLine = `${org.name || ''}, ИНН ${org.inn || ''}, КПП ${org.kpp || ''}, ${org.address || ''}`;
  const buyerLine = cp
    ? `${cp.name || '—'}, ${cp.address || ''}${cp.ogrn ? `, ОГРН ${cp.ogrn}` : ''}, ИНН/КПП ${cp.inn || '—'}/${cp.kpp || '—'}`
    : '—';

  const vatLabel = invoice.vatType === 'none' ? 'Без налога (НДС)' : `НДС ${invoice.vatType}%:`;
  const vatValue = invoice.vatType === 'none' ? '-' : formatNumber(invoice.vatAmount);

  let rows = '';
  for (const pos of invoice.positions) {
    rows += `<tr>
      <td style="text-align:center;">${pos.sortOrder}</td>
      <td>${escapeHtml(pos.name)}</td>
      <td style="text-align:center;">${pos.quantity}</td>
      <td style="text-align:center;">${escapeHtml(pos.unit)}</td>
      <td style="text-align:right;">${formatNumber(pos.price)}</td>
      <td style="text-align:right;">${formatNumber(pos.amount)}</td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Счёт на оплату № ${escapeHtml(invoice.number)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10.5pt;
      color: black;
      line-height: 1.25;
    }
    .invoice-title { text-align: left; font-size: 14pt; font-weight: bold; margin: 0 0 10px 0; }
    .bank-block { border: 1px solid black; margin-bottom: 10px; font-size: 9.5pt; line-height: 1.3; }
    .bank-block table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .bank-block td { padding: 3px 5px; vertical-align: middle; border: 1px solid black; }
    .bank-block .bl { font-weight: normal; }
    .bank-block .bv { font-weight: bold; }
    .bank-block .bacc { font-weight: bold; }
    .parties-block { margin-bottom: 8px; }
    .party-row { display: flex; margin-bottom: 4px; font-size: 9.5pt; line-height: 1.3; }
    .party-label { font-weight: normal; min-width: 150px; flex-shrink: 0; }
    .party-value { flex: 1; min-width: 0; font-weight: bold; }
    .basis-block { margin-bottom: 8px; font-size: 9.5pt; }
    .invoice-table-wrap { border: 2px solid black; margin-bottom: 8px; }
    .invoice-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; table-layout: fixed; }
    .invoice-table th, .invoice-table td { border: 1px solid black; padding: 4px 6px; word-wrap: break-word; }
    .invoice-table th { font-weight: bold; text-align: center; background: #f0f0f0 !important; }
    .invoice-table td { vertical-align: top; }
    .invoice-totals { text-align: right; margin-bottom: 8px; font-size: 9.5pt; }
    .invoice-totals p { margin: 2px 0; }
    .total-line { font-weight: bold; font-size: 11pt; border-top: 1px solid black; padding-top: 4px; margin-top: 4px; }
    .invoice-words { margin: 8px 0; padding: 4px 0; font-size: 9.5pt; }
    .invoice-signatures { display: flex; justify-content: space-between; margin-top: 18px; font-size: 9.5pt; }
    .signature-block { width: 48%; }
    .signature-line { display: flex; align-items: center; gap: 6px; margin-top: 22px; }
    .signature-dash { flex: 1; border-bottom: 1px solid black; min-width: 80px; }
    .signature-name { white-space: nowrap; }
  </style>
</head>
<body>
  <div class="invoice-title">Счёт на оплату № ${escapeHtml(invoice.number)} от ${formatRuDate(invoice.date)} г.</div>

  <div class="bank-block">
    <table>
      <tr>
        <td class="bl" style="width:18%">Банк получателя</td>
        <td class="bacc" colspan="3">${escapeHtml(org.bankName || '')}</td>
      </tr>
      <tr>
        <td class="bl">БИК</td>
        <td class="bv">${escapeHtml(org.bankBik || '')}</td>
        <td class="bl">Сч. №</td>
        <td class="bv">${escapeHtml(org.bankCorr || '')}</td>
      </tr>
      <tr>
        <td class="bl">ИНН</td>
        <td class="bv">${escapeHtml(org.inn || '')}</td>
        <td class="bl">КПП</td>
        <td class="bv">${escapeHtml(org.kpp || '')}</td>
      </tr>
      <tr>
        <td class="bl">Сч. №</td>
        <td class="bacc" colspan="3">${escapeHtml(org.bankAccount || '')}</td>
      </tr>
      <tr>
        <td class="bl">Получатель</td>
        <td class="bacc" colspan="3">${escapeHtml(org.name || '')}</td>
      </tr>
    </table>
  </div>

  <div class="parties-block">
    <div class="party-row">
      <span class="party-label">Поставщик (Исполнитель):</span>
      <span class="party-value">${escapeHtml(supplierLine)}</span>
    </div>
    <div class="party-row">
      <span class="party-label">Покупатель (Заказчик):</span>
      <span class="party-value">${escapeHtml(buyerLine)}</span>
    </div>
  </div>

  <div class="basis-block">Основание: ${escapeHtml(invoice.basis || '—')}</div>

  <div class="invoice-table-wrap">
    <table class="invoice-table">
      <thead><tr>
        <th style="width:5%;text-align:center;">№</th>
        <th style="width:53%">Товары (работы, услуги)</th>
        <th style="width:7%;text-align:center;">Кол-во</th>
        <th style="width:7%;text-align:center;">Ед.</th>
        <th style="width:12%;text-align:right;">Цена</th>
        <th style="width:12%;text-align:right;">Сумма</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="invoice-totals">
    <p>Итого: ${formatNumber(invoice.total)}</p>
    <p>${vatLabel} ${vatValue}</p>
    <p class="total-line">Всего к оплате: ${formatNumber(invoice.totalWithVat)}</p>
  </div>

  <div class="invoice-words">
    Всего наименований ${invoice.positions.length}, на сумму ${formatNumber(invoice.totalWithVat)} руб.<br>
    ${numberToWords(Number(invoice.totalWithVat))}
  </div>

  <div class="invoice-signatures">
    <div class="signature-block">
      <div>Руководитель</div>
      <div class="signature-line">
        <span class="signature-dash"></span>
        <span class="signature-name">${escapeHtml(org.director || '')}</span>
      </div>
    </div>
    <div class="signature-block">
      <div>Бухгалтер</div>
      <div class="signature-line">
        <span class="signature-dash"></span>
        <span class="signature-name">${escapeHtml(org.accountant || '')}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function generateActPrintHTML(
  org: Organization,
  cp: Counterparty | null,
  act: ActData
): string {
  const supplierLine = `${org.name || ''}, ИНН ${org.inn || ''}, КПП ${org.kpp || ''}, ${org.address || ''}`;
  const buyerLine = cp
    ? `${cp.name || '—'}, ${cp.address || ''}${cp.ogrn ? `, ОГРН ${cp.ogrn}` : ''}, ИНН/КПП ${cp.inn || '—'}/${cp.kpp || '—'}`
    : '—';

  const vatLabel = act.vatType === 'none' ? 'Без налога (НДС)' : `НДС ${act.vatType}%:`;
  const vatValue = act.vatType === 'none' ? '-' : formatNumber(act.vatAmount);

  const basisText = act.bases && act.bases.length > 0
    ? act.bases.filter(b => b.trim()).join('; ')
    : '—';

  let rows = '';
  for (const pos of act.positions) {
    rows += `<tr>
      <td style="text-align:center;">${pos.sortOrder}</td>
      <td>${escapeHtml(pos.name)}</td>
      <td style="text-align:center;">${pos.quantity}</td>
      <td style="text-align:center;">${escapeHtml(pos.unit)}</td>
      <td style="text-align:right;">${formatNumber(pos.price)}</td>
      <td style="text-align:right;">${formatNumber(pos.amount)}</td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Акт оказанных услуг № ${escapeHtml(act.number)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10.5pt;
      color: black;
      line-height: 1.25;
    }
    .act-title { text-align: left; font-size: 14pt; font-weight: bold; margin: 0 0 10px 0; }
    .parties-block { margin-bottom: 8px; }
    .party-row { display: flex; margin-bottom: 4px; font-size: 9.5pt; line-height: 1.3; }
    .party-label { font-weight: normal; min-width: 150px; flex-shrink: 0; }
    .party-value { flex: 1; min-width: 0; font-weight: bold; }
    .basis-block { margin-bottom: 8px; font-size: 9.5pt; }
    .act-table-wrap { border: 2px solid black; margin-bottom: 8px; }
    .act-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; table-layout: fixed; }
    .act-table th, .act-table td { border: 1px solid black; padding: 4px 6px; word-wrap: break-word; }
    .act-table th { font-weight: bold; text-align: center; background: #f0f0f0 !important; }
    .act-table td { vertical-align: top; }
    .act-totals { text-align: right; margin-bottom: 8px; font-size: 9.5pt; }
    .act-totals p { margin: 2px 0; }
    .total-line { font-weight: bold; font-size: 11pt; border-top: 1px solid black; padding-top: 4px; margin-top: 4px; }
    .act-words { margin: 8px 0; padding: 4px 0; font-size: 9.5pt; }
    .act-text { margin: 12px 0; font-size: 9.5pt; line-height: 1.4; }
    .act-signatures { display: flex; justify-content: space-between; margin-top: 18px; font-size: 9.5pt; }
    .signature-block { width: 48%; }
    .signature-label { font-weight: bold; margin-bottom: 4px; }
    .signature-name { margin-bottom: 22px; }
    .signature-line { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
    .signature-dash { flex: 1; border-bottom: 1px solid black; min-width: 80px; }
  </style>
</head>
<body>
  <div class="act-title">Акт оказанных услуг № ${escapeHtml(act.number)} от ${formatRuDate(act.date)} г.</div>

  <div class="parties-block">
    <div class="party-row">
      <span class="party-label">Исполнитель:</span>
      <span class="party-value">${escapeHtml(supplierLine)}</span>
    </div>
    <div class="party-row">
      <span class="party-label">Заказчик:</span>
      <span class="party-value">${escapeHtml(buyerLine)}</span>
    </div>
  </div>

  <div class="basis-block">Основание: ${escapeHtml(basisText)}</div>

  <div class="act-table-wrap">
    <table class="act-table">
      <thead><tr>
        <th style="width:5%;text-align:center;">№</th>
        <th style="width:53%">Наименование работ, услуг</th>
        <th style="width:7%;text-align:center;">Кол-во</th>
        <th style="width:7%;text-align:center;">Ед.</th>
        <th style="width:12%;text-align:right;">Цена</th>
        <th style="width:12%;text-align:right;">Сумма</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="act-totals">
    <p>Итого: ${formatNumber(act.total)}</p>
    <p>${vatLabel} ${vatValue}</p>
    <p class="total-line">Всего: ${formatNumber(act.totalWithVat)}</p>
  </div>

  <div class="act-words">
    Всего наименований ${act.positions.length}, на сумму ${formatNumber(act.totalWithVat)} руб.<br>
    ${numberToWords(Number(act.totalWithVat))}
  </div>

  <div class="act-text">
    Вышеперечисленные услуги выполнены полностью и в срок. Заказчик претензий по объему, качеству и срокам оказания услуг не имеет.
  </div>

  <div class="act-signatures">
    <div class="signature-block">
      <div class="signature-label">ИСПОЛНИТЕЛЬ</div>
      <div class="signature-name">${escapeHtml(org.director || '')}</div>
      <div class="signature-line">
        <span class="signature-dash"></span>
      </div>
    </div>
    <div class="signature-block">
      <div class="signature-label">ЗАКАЗЧИК</div>
      <div class="signature-name">${escapeHtml(cp?.name || '')}</div>
      <div class="signature-line">
        <span class="signature-dash"></span>
      </div>
    </div>
  </div>
</body>
</html>`;
}
