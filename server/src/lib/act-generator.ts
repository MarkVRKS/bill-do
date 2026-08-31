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
}

interface Counterparty {
  name: string;
  address: string;
  ogrn: string;
  inn: string;
  kpp: string;
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

export async function generateAct(
  org: Organization,
  cp: Counterparty | null,
  act: ActData
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Счетовод';
  wb.created = new Date();

  const ws = wb.addWorksheet('Акт', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToHeight: 1,
      fitToWidth: 1,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
    properties: { defaultColWidth: 10 },
  });

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
  ];

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

  // ===== TITLE (row 3) =====
  ws.mergeCells('B3:AF3');
  ws.getCell('B3').value = `Акт оказанных услуг № ${act.number} от ${formatRuDate(act.date)} г.`;
  ws.getCell('B3').font = fontTitle;
  ws.getRow(3).height = 28;

  // ===== SUPPLIER (row 5) =====
  ws.mergeCells('B5:E5');
  ws.getCell('B5').value = 'Исполнитель:';
  ws.getCell('B5').font = fontNormal;

  ws.mergeCells('F5:AF5');
  const supplierLine = `${org.name || ''}, ИНН ${org.inn || ''}, КПП ${org.kpp || ''}, ${org.address || ''}`;
  ws.getCell('F5').value = supplierLine;
  ws.getCell('F5').font = fontBold;
  ws.getCell('F5').alignment = wrapAlign;

  // ===== BUYER (row 7) =====
  ws.mergeCells('B7:E7');
  ws.getCell('B7').value = 'Заказчик:';
  ws.getCell('B7').font = fontNormal;

  ws.mergeCells('F7:AF7');
  const buyerLine = cp
    ? `${cp.name || '—'}, ${cp.address || ''}${cp.ogrn ? `, ОГРН ${cp.ogrn}` : ''}, ИНН/КПП ${cp.inn || '—'}/${cp.kpp || '—'}`
    : '—';
  ws.getCell('F7').value = buyerLine;
  ws.getCell('F7').font = fontBold;
  ws.getCell('F7').alignment = wrapAlign;

  // ===== BASIS (row 9) =====
  ws.mergeCells('B9:E9');
  ws.getCell('B9').value = 'Основание:';
  ws.getCell('B9').font = fontNormal;

  ws.mergeCells('F9:AF9');
  const basisText = act.bases && act.bases.length > 0
    ? act.bases.filter(b => b.trim()).join('; ')
    : '—';
  ws.getCell('F9').value = basisText;
  ws.getCell('F9').font = fontBold;

  // ===== TABLE HEADER (rows 11-12) =====
  ws.getRow(11).height = 20;
  ws.getRow(12).height = 20;

  // №
  ws.mergeCells('B11:C12');
  ws.getCell('B11').value = '№';
  ws.getCell('B11').font = fontHeader;
  ws.getCell('B11').alignment = centerAlign;
  ws.getCell('B11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  // Наименование работ, услуг
  ws.mergeCells('D11:T12');
  ws.getCell('D11').value = 'Наименование работ, услуг';
  ws.getCell('D11').font = fontHeader;
  ws.getCell('D11').alignment = centerAlign;
  ws.getCell('D11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  // Кол-во
  ws.mergeCells('U11:W12');
  ws.getCell('U11').value = 'Кол-во';
  ws.getCell('U11').font = fontHeader;
  ws.getCell('U11').alignment = centerAlign;
  ws.getCell('U11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  // Ед.
  ws.mergeCells('X11:Y12');
  ws.getCell('X11').value = 'Ед.';
  ws.getCell('X11').font = fontHeader;
  ws.getCell('X11').alignment = centerAlign;
  ws.getCell('X11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  // Цена
  ws.mergeCells('Z11:AC12');
  ws.getCell('Z11').value = 'Цена';
  ws.getCell('Z11').font = fontHeader;
  ws.getCell('Z11').alignment = centerAlign;
  ws.getCell('Z11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  // Сумма
  ws.mergeCells('AD11:AG12');
  ws.getCell('AD11').value = 'Сумма';
  ws.getCell('AD11').font = fontHeader;
  ws.getCell('AD11').alignment = centerAlign;
  ws.getCell('AD11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  // Borders for header
  for (let col = 2; col <= 33; col++) {
    const cell11 = ws.getRow(11).getCell(col);
    cell11.border = thinBorder;
    cell11.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    const cell12 = ws.getRow(12).getCell(col);
    cell12.border = thinBorder;
    cell12.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
  }

  // ===== DATA ROWS =====
  let currentRow = 13;
  for (const pos of act.positions) {
    const row = ws.getRow(currentRow);
    row.height = 30;

    // № (B-C)
    ws.mergeCells(`B${currentRow}:C${currentRow}`);
    row.getCell(2).value = pos.sortOrder;
    row.getCell(2).font = fontNormal;
    row.getCell(2).alignment = centerAlign;

    // Name (D-T)
    ws.mergeCells(`D${currentRow}:T${currentRow}`);
    row.getCell(4).value = pos.name;
    row.getCell(4).font = fontNormal;
    row.getCell(4).alignment = wrapAlign;

    // Quantity (U-W)
    ws.mergeCells(`U${currentRow}:W${currentRow}`);
    row.getCell(21).value = Number(pos.quantity);
    row.getCell(21).font = fontNormal;
    row.getCell(21).alignment = centerAlign;
    row.getCell(21).numFmt = '#,##0.00';

    // Unit (X-Y)
    ws.mergeCells(`X${currentRow}:Y${currentRow}`);
    row.getCell(24).value = pos.unit;
    row.getCell(24).font = fontNormal;
    row.getCell(24).alignment = centerAlign;

    // Price (Z-AC)
    ws.mergeCells(`Z${currentRow}:AC${currentRow}`);
    row.getCell(26).value = Number(pos.price);
    row.getCell(26).font = fontNormal;
    row.getCell(26).alignment = rightAlign;
    row.getCell(26).numFmt = '#,##0.00';

    // Amount (AD-AG) formula: price * quantity
    ws.mergeCells(`AD${currentRow}:AG${currentRow}`);
    row.getCell(30).value = { formula: `Z${currentRow}*U${currentRow}`, result: Number(pos.amount) };
    row.getCell(30).font = fontNormal;
    row.getCell(30).alignment = rightAlign;
    row.getCell(30).numFmt = '#,##0.00';

    // Borders
    for (let col = 2; col <= 33; col++) {
      row.getCell(col).border = thinBorder;
    }

    currentRow++;
  }

  // ===== TOTALS =====
  const lastDataRow = currentRow - 1;
  const firstDataRow = 13;

  // Blank row
  currentRow++;

  // Итого
  ws.mergeCells(`AC${currentRow}:AG${currentRow}`);
  ws.getCell(`AC${currentRow}`).value = 'Итого:';
  ws.getCell(`AC${currentRow}`).font = fontBold;
  ws.getCell(`AC${currentRow}`).alignment = rightAlign;

  ws.mergeCells(`AD${currentRow}:AG${currentRow}`);
  // Already merged above, use AD column
  const itogoRow = currentRow;
  ws.getCell(`AD${itogoRow}`).value = { formula: `SUM(AD${firstDataRow}:AD${lastDataRow})`, result: Number(act.total) };
  ws.getCell(`AD${itogoRow}`).font = fontBold;
  ws.getCell(`AD${itogoRow}`).alignment = rightAlign;
  ws.getCell(`AD${itogoRow}`).numFmt = '#,##0.00';
  currentRow++;

  // НДС
  ws.mergeCells(`AC${currentRow}:AG${currentRow}`);
  const vatLabel = act.vatType === 'none' ? 'Без налога (НДС)' : `НДС ${act.vatType}%:`;
  ws.getCell(`AC${currentRow}`).value = vatLabel;
  ws.getCell(`AC${currentRow}`).font = fontNormal;
  ws.getCell(`AC${currentRow}`).alignment = rightAlign;

  ws.mergeCells(`AD${currentRow}:AG${currentRow}`);
  ws.getCell(`AD${currentRow}`).value = act.vatType === 'none' ? '-' : Number(act.vatAmount);
  ws.getCell(`AD${currentRow}`).font = fontNormal;
  ws.getCell(`AD${currentRow}`).alignment = rightAlign;
  ws.getCell(`AD${currentRow}`).numFmt = '#,##0.00';
  currentRow += 2;

  // ===== ITEMS SUMMARY =====
  ws.mergeCells(`B${currentRow}:AG${currentRow}`);
  ws.getCell(`B${currentRow}`).value = `Всего наименований ${act.positions.length}, на сумму ${formatNumber(act.totalWithVat)} руб.`;
  ws.getCell(`B${currentRow}`).font = fontNormal;
  currentRow++;

  // Sum in words
  ws.mergeCells(`B${currentRow}:AG${currentRow}`);
  ws.getCell(`B${currentRow}`).value = numberToWords(Number(act.totalWithVat));
  ws.getCell(`B${currentRow}`).font = fontNormal;
  ws.getCell(`B${currentRow}`).alignment = wrapAlign;
  ws.getRow(currentRow).height = 30;
  currentRow += 2;

  // ===== STANDARD TEXT =====
  ws.mergeCells(`B${currentRow}:AG${currentRow + 1}`);
  ws.getCell(`B${currentRow}`).value = 'Вышеперечисленные услуги выполнены полностью и в срок. Заказчик претензий по объему, качеству и срокам оказания услуг не имеет.';
  ws.getCell(`B${currentRow}`).font = fontNormal;
  ws.getCell(`B${currentRow}`).alignment = wrapAlign;
  ws.getRow(currentRow).height = 28;
  currentRow += 3;

  // ===== SIGNATURES =====
  // ИСПОЛНИТЕЛЬ / ЗАКАЗЧИК labels
  ws.mergeCells(`B${currentRow}:T${currentRow}`);
  ws.getCell(`B${currentRow}`).value = 'ИСПОЛНИТЕЛЬ';
  ws.getCell(`B${currentRow}`).font = fontBold;

  ws.mergeCells(`U${currentRow}:AG${currentRow}`);
  ws.getCell(`U${currentRow}`).value = 'ЗАКАЗЧИК';
  ws.getCell(`U${currentRow}`).font = fontBold;
  currentRow++;

  // Director names
  ws.mergeCells(`B${currentRow}:T${currentRow}`);
  ws.getCell(`B${currentRow}`).value = org.director || '';
  ws.getCell(`B${currentRow}`).font = fontNormal;

  ws.mergeCells(`U${currentRow}:AG${currentRow}`);
  ws.getCell(`U${currentRow}`).value = cp?.name || '';
  ws.getCell(`U${currentRow}`).font = fontNormal;
  currentRow += 2;

  // Signature lines
  ws.mergeCells(`B${currentRow}:T${currentRow}`);
  ws.getCell(`B${currentRow}`).value = '___________________________ /                     /';
  ws.getCell(`B${currentRow}`).font = fontNormal;

  ws.mergeCells(`U${currentRow}:AG${currentRow}`);
  ws.getCell(`U${currentRow}`).value = '___________________________ /                     /';
  ws.getCell(`U${currentRow}`).font = fontNormal;

  const buffer = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  return buffer;
}
