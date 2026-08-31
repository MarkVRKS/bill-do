import ExcelJS from 'exceljs';

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
  bankName: string;
  bankBik: string;
  bankCorr: string;
  bankAccount: string;
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
  bases?: string[];
  signer: string;
  serviceMonth: number;
  serviceYear: number;
  vatType: string;
  total: string;
  vatAmount: string;
  totalWithVat: string;
  positions: Position[];
}

const MONTHS_GENITIVE = [
  '', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

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
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

  function group(n: number, fem: boolean): string {
    let r = '';
    if (n >= 100) { r += hundreds[Math.floor(n / 100)] + ' '; n %= 100; }
    if (n >= 20) { r += tens[Math.floor(n / 10)] + ' '; n %= 10; }
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

export async function generateExcel(
  org: Organization,
  cp: Counterparty | null,
  invoice: InvoiceData
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Счетовод';
  wb.created = new Date();

  const ws = wb.addWorksheet('Счёт на оплату', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToHeight: 1,
      fitToWidth: 1,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
    properties: { defaultColWidth: 10 },
  });

  // Column widths matching original template
  ws.columns = [
    { width: 1.16 },  // A
    { width: 3.5 },   // B
    { width: 1.82 },  // C
    { width: 1.65 },  // D
    { width: 3.5 },   // E
    { width: 4.33 },  // F
    { width: 2.5 },   // G
    { width: 0.5 },   // H
    { width: 2.99 },  // I
    { width: 3.5 },   // J
    { width: 3.5 },   // K
    { width: 3.5 },   // L
    { width: 3.5 },   // M
    { width: 3.5 },   // N
    { width: 3.5 },   // O
    { width: 3.5 },   // P
    { width: 3.5 },   // Q
    { width: 2.82 },  // R
    { width: 1.32 },  // S
    { width: 2.82 },  // T
    { width: 2.16 },  // U
    { width: 1.32 },  // V
    { width: 0.16 },  // W
    { width: 3.33 },  // X
    { width: 2.16 },  // Y
    { width: 1.32 },  // Z
    { width: 2.16 },  // AA
    { width: 2.16 },  // AB
    { width: 2.16 },  // AC
    { width: 2.16 },  // AD
    { width: 2.16 },  // AE
    { width: 2.16 },  // AF
    { width: 2.16 },  // AG
    { width: 2.16 },  // AH
    { width: 2.16 },  // AI
    { width: 2.16 },  // AJ
    { width: 2.16 },  // AK
    { width: 2.16 },  // AL
    { width: 2.16 },  // AM
    { width: 2.16 },  // AN
    { width: 2.16 },  // AO
    { width: 2.16 },  // AP
    { width: 2.16 },  // AQ
    { width: 2.16 },  // AR
  ];

  // ===== STYLES =====
  const fontNormal = { name: 'Times New Roman', size: 10 };
  const fontBold = { name: 'Times New Roman', size: 10, bold: true };
  const fontSmall = { name: 'Times New Roman', size: 9 };
  const fontTitle = { name: 'Times New Roman', size: 14, bold: true };
  const fontHeader = { name: 'Times New Roman', size: 9, bold: true };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  const wrapAlign: Partial<ExcelJS.Alignment> = { wrapText: true, vertical: 'middle' };
  const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const rightAlign: Partial<ExcelJS.Alignment> = { horizontal: 'right', vertical: 'middle' };

  // ===== BANK BLOCK (rows 1-9) =====
  // Row 1: БИК header
  ws.mergeCells('B2:W3');
  ws.getCell('B2').value = 'ТУЛЬСКОЕ ОТДЕЛЕНИЕ № 8604';
  ws.getCell('B2').font = fontNormal;

  ws.mergeCells('X2:AC4');
  ws.getCell('X2').value = org.bankBik ? `БИК ${org.bankBik}` : '';
  ws.getCell('X2').font = fontSmall;

  ws.mergeCells('AD2:AR4');
  ws.getCell('AD2').value = 'Банк получателя';
  ws.getCell('AD2').font = fontNormal;

  // Row 3: Банк получателя label
  ws.mergeCells('B4:W4');
  ws.getCell('B4').value = 'Банк получателя';
  ws.getCell('B4').font = fontNormal;

  ws.mergeCells('X5:AC8');
  ws.getCell('X5').value = org.bankCorr ? `Сч. № ${org.bankCorr}` : '';
  ws.getCell('X5').font = fontSmall;

  ws.mergeCells('AD5:AR8');
  ws.getCell('AD5').value = org.bankName || '';
  ws.getCell('AD5').font = fontNormal;
  ws.getCell('AD5').alignment = wrapAlign;

  // Row 5: ИНН / КПП
  ws.mergeCells('B5:D5');
  ws.getCell('B5').value = 'ИНН';
  ws.getCell('B5').font = fontNormal;

  ws.getCell('E5').value = org.inn || '';
  ws.getCell('E5').font = fontBold;

  ws.mergeCells('F5:L5');
  ws.getCell('F5').value = 'КПП';
  ws.getCell('F5').font = fontNormal;

  ws.getCell('M5').value = org.kpp || '';
  ws.getCell('M5').font = fontBold;

  ws.mergeCells('O5:W5');
  ws.getCell('O5').value = 'Сч. №';
  ws.getCell('O5').font = fontNormal;

  // Bank account value in X5:AC8 (already merged above at line 231)
  ws.getCell('X5').value = org.bankAccount ? `Сч. № ${org.bankAccount}` : '';
  ws.getCell('X5').font = fontSmall;

  // Row 6-7: Organization name
  ws.mergeCells('B6:W7');
  ws.getCell('B6').value = org.name || '';
  ws.getCell('B6').font = fontBold;

  // Row 8: Получатель
  ws.mergeCells('B8:W8');
  ws.getCell('B8').value = 'Получатель';
  ws.getCell('B8').font = fontNormal;

  // Row 10-11: Title
  ws.mergeCells('B10:AR11');
  ws.getCell('B10').value = `Счет на оплату № ${invoice.number} от ${formatRuDate(invoice.date)} г.`;
  ws.getCell('B10').font = fontTitle;

  // Row 12: Divider
  ws.mergeCells('B12:AR12');

  // Row 13: Empty
  // Row 14: Поставщик
  ws.mergeCells('B14:F15');
  ws.getCell('B14').value = 'Поставщик\n(Исполнитель):';
  ws.getCell('B14').font = fontNormal;
  ws.getCell('B14').alignment = wrapAlign;

  ws.mergeCells('G14:AR15');
  const supplierLine = `${org.name || ''}, ИНН ${org.inn || ''}, КПП ${org.kpp || ''}, ${org.address || ''}`;
  ws.getCell('G14').value = supplierLine;
  ws.getCell('G14').font = fontBold;
  ws.getCell('G14').alignment = wrapAlign;

  // Row 17-18: Покупатель
  ws.mergeCells('B17:F18');
  ws.getCell('B17').value = 'Покупатель\n(Заказчик):';
  ws.getCell('B17').font = fontNormal;
  ws.getCell('B17').alignment = wrapAlign;

  ws.mergeCells('G17:AR18');
  const buyerLine = cp
    ? `${cp.name || '—'}, ${cp.address || ''}${cp.ogrn ? `, ОГРН ${cp.ogrn}` : ''}, ИНН/КПП ${cp.inn || '—'}/${cp.kpp || '—'}`
    : '—';
  ws.getCell('G17').value = buyerLine;
  ws.getCell('G17').font = fontBold;
  ws.getCell('G17').alignment = wrapAlign;

  // Row 20: Основание
  ws.mergeCells('B20:F20');
  ws.getCell('B20').value = 'Основание:';
  ws.getCell('B20').font = fontNormal;

  ws.mergeCells('G20:AR20');
  const basisText = invoice.bases && invoice.bases.length > 0
    ? invoice.bases.filter(b => b.trim()).join('; ')
    : invoice.basis || '—';
  ws.getCell('G20').value = basisText;
  ws.getCell('G20').font = fontBold;

  // ===== TABLE HEADER (row 22) =====
  ws.getRow(22).height = 20;

  ws.mergeCells('B22:C22');
  ws.getCell('B22').value = '№';
  ws.getCell('B22').font = fontHeader;
  ws.getCell('B22').alignment = centerAlign;
  ws.getCell('B22').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  ws.mergeCells('D22:X22');
  ws.getCell('D22').value = 'Товары (работы, услуги)';
  ws.getCell('D22').font = fontHeader;
  ws.getCell('D22').alignment = centerAlign;
  ws.getCell('D22').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  ws.mergeCells('Y22:AB22');
  ws.getCell('Y22').value = 'Кол-во';
  ws.getCell('Y22').font = fontHeader;
  ws.getCell('Y22').alignment = centerAlign;
  ws.getCell('Y22').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  ws.mergeCells('AC22:AE22');
  ws.getCell('AC22').value = 'Ед.';
  ws.getCell('AC22').font = fontHeader;
  ws.getCell('AC22').alignment = centerAlign;
  ws.getCell('AC22').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  ws.mergeCells('AF22:AJ22');
  ws.getCell('AF22').value = 'Цена';
  ws.getCell('AF22').font = fontHeader;
  ws.getCell('AF22').alignment = centerAlign;
  ws.getCell('AF22').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  ws.mergeCells('AK22:AQ22');
  ws.getCell('AK22').value = 'Сумма';
  ws.getCell('AK22').font = fontHeader;
  ws.getCell('AK22').alignment = centerAlign;
  ws.getCell('AK22').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  // Apply borders to header row
  for (let col = 2; col <= 44; col++) {
    const cell = ws.getRow(22).getCell(col);
    cell.border = thinBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
  }

  // ===== DATA ROWS =====
  let currentRow = 23;
  for (const pos of invoice.positions) {
    const row = ws.getRow(currentRow);
    row.height = 30;

    // Col B-C: №
    ws.mergeCells(`B${currentRow}:C${currentRow}`);
    row.getCell(2).value = pos.sortOrder;
    row.getCell(2).font = fontNormal;
    row.getCell(2).alignment = centerAlign;

    // Col D-X: Name
    ws.mergeCells(`D${currentRow}:X${currentRow}`);
    row.getCell(4).value = pos.name;
    row.getCell(4).font = fontNormal;
    row.getCell(4).alignment = wrapAlign;

    // Col Y-AB: Quantity
    ws.mergeCells(`Y${currentRow}:AB${currentRow}`);
    row.getCell(25).value = Number(pos.quantity);
    row.getCell(25).font = fontNormal;
    row.getCell(25).alignment = centerAlign;
    row.getCell(25).numFmt = '#,##0.00';

    // Col AC-AE: Unit
    ws.mergeCells(`AC${currentRow}:AE${currentRow}`);
    row.getCell(29).value = pos.unit;
    row.getCell(29).font = fontNormal;
    row.getCell(29).alignment = centerAlign;

    // Col AF-AJ: Price
    ws.mergeCells(`AF${currentRow}:AJ${currentRow}`);
    row.getCell(32).value = Number(pos.price);
    row.getCell(32).font = fontNormal;
    row.getCell(32).alignment = rightAlign;
    row.getCell(32).numFmt = '#,##0.00';

    // Col AK-AQ: Amount (formula)
    ws.mergeCells(`AK${currentRow}:AQ${currentRow}`);
    row.getCell(37).value = { formula: `AF${currentRow}*Y${currentRow}`, result: Number(pos.amount) };
    row.getCell(37).font = fontNormal;
    row.getCell(37).alignment = rightAlign;
    row.getCell(37).numFmt = '#,##0.00';

    // Borders
    for (let col = 2; col <= 44; col++) {
      row.getCell(col).border = thinBorder;
    }

    currentRow++;
  }

  // ===== TOTALS =====
  const lastDataRow = currentRow - 1;
  const firstDataRow = 23;

  // Row after data: blank
  currentRow++;

  // Row: Итого
  ws.mergeCells(`AA${currentRow}:AK${currentRow}`);
  ws.getCell(`AA${currentRow}`).value = 'Итого:';
  ws.getCell(`AA${currentRow}`).font = fontBold;
  ws.getCell(`AA${currentRow}`).alignment = rightAlign;

  ws.mergeCells(`AL${currentRow}:AQ${currentRow}`);
  ws.getCell(`AL${currentRow}`).value = { formula: `SUM(AK${firstDataRow}:AK${lastDataRow})`, result: Number(invoice.total) };
  ws.getCell(`AL${currentRow}`).font = fontBold;
  ws.getCell(`AL${currentRow}`).alignment = rightAlign;
  ws.getCell(`AL${currentRow}`).numFmt = '#,##0.00';
  currentRow++;

  // Row: VAT
  const vatLabel = invoice.vatType === 'none' ? 'Без налога (НДС)' : `НДС ${invoice.vatType}%:`;
  ws.mergeCells(`AA${currentRow}:AK${currentRow}`);
  ws.getCell(`AA${currentRow}`).value = vatLabel;
  ws.getCell(`AA${currentRow}`).font = fontNormal;
  ws.getCell(`AA${currentRow}`).alignment = rightAlign;

  ws.mergeCells(`AL${currentRow}:AQ${currentRow}`);
  ws.getCell(`AL${currentRow}`).value = invoice.vatType === 'none' ? '-' : Number(invoice.vatAmount);
  ws.getCell(`AL${currentRow}`).font = fontNormal;
  ws.getCell(`AL${currentRow}`).alignment = rightAlign;
  ws.getCell(`AL${currentRow}`).numFmt = '#,##0.00';
  currentRow++;

  // Row: Всего к оплате
  ws.mergeCells(`AA${currentRow}:AK${currentRow}`);
  ws.getCell(`AA${currentRow}`).value = 'Всего к оплате:';
  ws.getCell(`AA${currentRow}`).font = fontBold;
  ws.getCell(`AA${currentRow}`).alignment = rightAlign;

  ws.mergeCells(`AL${currentRow}:AQ${currentRow}`);
  ws.getCell(`AL${currentRow}`).value = Number(invoice.totalWithVat);
  ws.getCell(`AL${currentRow}`).font = { ...fontBold, size: 11 };
  ws.getCell(`AL${currentRow}`).alignment = rightAlign;
  ws.getCell(`AL${currentRow}`).numFmt = '#,##0.00';

  // Top border for totals
  for (let col = 27; col <= 44; col++) {
    const cell = ws.getRow(currentRow - 2).getCell(col);
    if (!cell.border?.top) cell.border = { ...thinBorder, top: { style: 'thin' } };
  }
  currentRow++;

  // Blank row
  currentRow++;

  // Row: Items summary
  ws.mergeCells(`B${currentRow}:AQ${currentRow}`);
  ws.getCell(`B${currentRow}`).value = `Всего наименований ${invoice.positions.length}, на сумму ${formatNumber(invoice.totalWithVat)} руб.`;
  ws.getCell(`B${currentRow}`).font = fontNormal;
  currentRow++;

  // Row: Sum in words
  ws.mergeCells(`B${currentRow}:AQ${currentRow}`);
  ws.getCell(`B${currentRow}`).value = numberToWords(Number(invoice.totalWithVat));
  ws.getCell(`B${currentRow}`).font = fontNormal;
  ws.getCell(`B${currentRow}`).alignment = wrapAlign;
  ws.getRow(currentRow).height = 30;
  currentRow += 2;

  // ===== SIGNATURES =====
  const sigRow = currentRow;
  ws.mergeCells(`B${sigRow}:AR${sigRow}`);

  ws.getCell(`B${sigRow}`).value = `Руководитель                          ${org.director || ''}                            Бухгалтер                          ${org.accountant || ''}`;
  ws.getCell(`B${sigRow}`).font = fontNormal;

  // Write buffer
  const buffer = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  return buffer;
}
