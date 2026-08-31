// PDF generation via Electron BrowserWindow with temp file approach
const fs = require('fs');
const path = require('path');
const os = require('os');

let BrowserWindow;
try { BrowserWindow = require('electron').BrowserWindow; } catch(e) { BrowserWindow = null; }

function formatRuDate(d) { const [y,m,dd] = d.split('-'); return `${dd}.${m}.${y}`; }
function fmt(n) { return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n)); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function numberToWords(num) {
  if (num === 0) return 'Ноль рублей 00 копеек';
  const ones=['','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
  const onesF=['','одна','две','три','четыре','пять','шесть','семь','восемь','девять'];
  const teens=['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const tensA=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
  const hundreds=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
  function g(n,f){let r='';if(n>=100){r+=hundreds[Math.floor(n/100)]+' ';n%=100}if(n>=20){r+=tensA[Math.floor(n/10)]+' ';n%=10}else if(n>=10)return r+teens[n-10]+' ';if(n>0)r+=(f?onesF:ones)[n]+' ';return r}
  function rf(n){const l2=n%100,l1=n%10;if(l2>=11&&l2<=19)return'рублей';if(l1===1)return'рубль';if(l1>=2&&l1<=4)return'рубля';return'рублей'}
  function kf(n){if(n===0)return'копеек';const l2=n%100,l1=n%10;if(l2>=11&&l2<=19)return'копеек';if(l1===1)return'копейка';if(l1>=2&&l1<=4)return'копейки';return'копеек'}
  function IF(n,w,f1,f23,f5){if(n===0)return'';const l2=n%100,l1=n%10;let s=f5;if(l2>=11&&l2<=19)s=f5;else if(l1===1)s=f1;else if(l1>=2&&l1<=4)s=f23;return g(n>=1000?n%1000:n,w==='тысяч')+w+s+' '}
  const rub=Math.floor(num),kop=Math.round((num-rub)*100);let r='';
  if(rub>=1e9)r+=IF(Math.floor(rub/1e9),'миллиард','','а','ов');
  if(rub>=1e6)r+=IF(Math.floor((rub%1e9)/1e6),'миллион','','а','ов');
  if(rub>=1e3)r+=IF(Math.floor((rub%1e6)/1e3),'тысяч','а','и','');
  const rem=rub%1000;if(rem>0||rub===0)r+=g(rem,false);
  r=r.trim()+' '+rf(rub);r+=' '+kop.toString().padStart(2,'0')+' '+kf(kop);return r.charAt(0).toUpperCase()+r.slice(1);
}

function getBasisText(inv) {
  if (inv.bases && inv.bases.length > 0) return inv.bases.filter(b => b && b.trim()).join('; ');
  return inv.basis || '—';
}

function invoiceHTML(org, cp, inv) {
  const sl = `${esc(org.name||'')}, ИНН ${esc(org.inn||'')}, КПП ${esc(org.kpp||'')}, ${esc(org.address||'')}`;
  const bl = cp ? `${esc(cp.name||'—')}, ${esc(cp.address||'')}${cp.ogrn?', ОГРН '+esc(cp.ogrn):''}, ИНН/КПП ${esc(cp.inn||'—')}/${esc(cp.kpp||'—')}` : '—';
  const basis = esc(getBasisText(inv));
  let rows = '';
  for (const p of inv.positions) {
    rows += `<tr><td style="text-align:center">${p.sortOrder}</td><td>${esc(p.name)}</td><td style="text-align:center">${p.quantity}</td><td style="text-align:center">${esc(p.unit)}</td><td style="text-align:right">${fmt(p.price)}</td><td style="text-align:right">${fmt(p.amount)}</td></tr>`;
  }
  const vl = inv.vatType === 'none' ? 'Без налога (НДС)' : `НДС ${inv.vatType}%:`;
  const vv = inv.vatType === 'none' ? '-' : fmt(inv.vatAmount);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page{size:A4;margin:10mm 12mm}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',serif;font-size:10.5pt;color:#000;line-height:1.25}
.t{font-size:14pt;font-weight:bold;margin:0 0 10px}
.b{border:1px solid #000;margin-bottom:10px;font-size:9.5pt}.b table{width:100%;border-collapse:collapse}.b td{padding:3px 5px;border:1px solid #000}
.b .bl{font-weight:normal}.b .bv{font-weight:bold}.b .bacc{font-weight:bold}
.pb{margin-bottom:8px}.pr{display:flex;margin-bottom:4px;font-size:9.5pt}.pr span:first-child{min-width:150px;flex-shrink:0}.pr span:last-child{flex:1;font-weight:bold}
.bb{margin-bottom:8px;font-size:9.5pt}
.tw{border:2px solid #000;margin-bottom:8px}
.it{width:100%;border-collapse:collapse;font-size:9.5pt}.it th,.it td{border:1px solid #000;padding:4px 6px}.it th{font-weight:bold;text-align:center;background:#f0f0f0}
.tot{text-align:right;margin-bottom:8px;font-size:9.5pt}.tot p{margin:2px 0}.tl{font-weight:bold;font-size:11pt;border-top:1px solid #000;padding-top:4px;margin-top:4px}
.iw{margin:8px 0;font-size:9.5pt}
.sig{display:flex;justify-content:space-between;margin-top:18px;font-size:9.5pt}.sb{width:48%}.sl{display:flex;align-items:center;gap:6px;margin-top:22px}.sd{flex:1;border-bottom:1px solid #000;min-width:80px}.sn{white-space:nowrap}
</style></head><body>
<div class="t">Счёт на оплату № ${esc(inv.number)} от ${formatRuDate(inv.date)} г.</div>
<div class="b"><table>
<tr><td class="bl" style="width:18%">Банк получателя</td><td class="bacc" colspan="3">${esc(org.bankName||'')}</td></tr>
<tr><td class="bl">БИК</td><td class="bv">${esc(org.bankBik||'')}</td><td class="bl">Сч. №</td><td class="bv">${esc(org.bankCorr||'')}</td></tr>
<tr><td class="bl">ИНН</td><td class="bv">${esc(org.inn||'')}</td><td class="bl">КПП</td><td class="bv">${esc(org.kpp||'')}</td></tr>
<tr><td class="bl">Сч. №</td><td class="bacc" colspan="3">${esc(org.bankAccount||'')}</td></tr>
<tr><td class="bl">Получатель</td><td class="bacc" colspan="3">${esc(org.name||'')}</td></tr></table></div>
<div class="pb"><div class="pr"><span>Поставщик:</span><span>${sl}</span></div><div class="pr"><span>Покупатель:</span><span>${bl}</span></div></div>
<div class="bb">Основание: ${basis}</div>
<div class="tw"><table class="it"><thead><tr><th style="width:5%">№</th><th style="width:53%">Товары (работы, услуги)</th><th style="width:7%">Кол-во</th><th style="width:7%">Ед.</th><th style="width:12%">Цена</th><th style="width:12%">Сумма</th></tr></thead><tbody>${rows}</tbody></table></div>
<div class="tot"><p>Итого: ${fmt(inv.total)}</p><p>${vl} ${vv}</p><p class="tl">Всего к оплате: ${fmt(inv.totalWithVat)}</p></div>
<div class="iw">Всего наименований ${inv.positions.length}, на сумму ${fmt(inv.totalWithVat)} руб.<br/>${numberToWords(Number(inv.totalWithVat))}</div>
<div class="sig"><div class="sb"><div>Руководитель</div><div class="sl"><span class="sd"></span><span class="sn">${esc(org.director||'')}</span></div></div><div class="sb"><div>Бухгалтер</div><div class="sl"><span class="sd"></span><span class="sn">${esc(org.accountant||'')}</span></div></div></div>
</body></html>`;
}

function actHTML(org, cp, inv) {
  const sl = `${esc(org.name||'')}, ИНН ${esc(org.inn||'')}, КПП ${esc(org.kpp||'')}, ${esc(org.address||'')}`;
  const bl = cp ? `${esc(cp.name||'—')}, ${esc(cp.address||'')}${cp.ogrn?', ОГРН '+esc(cp.ogrn):''}, ИНН/КПП ${esc(cp.inn||'—')}/${esc(cp.kpp||'—')}` : '—';
  const basis = esc(getBasisText(inv));
  let rows = '';
  for (const p of inv.positions) {
    rows += `<tr><td style="text-align:center">${p.sortOrder}</td><td>${esc(p.name)}</td><td style="text-align:center">${p.quantity}</td><td style="text-align:center">${esc(p.unit)}</td><td style="text-align:right">${fmt(p.price)}</td><td style="text-align:right">${fmt(p.amount)}</td></tr>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page{size:A4;margin:10mm 12mm}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',serif;font-size:10.5pt;color:#000;line-height:1.25}
.t{font-size:14pt;font-weight:bold;margin:0 0 14px}
.pb{margin-bottom:8px}.pr{display:flex;margin-bottom:4px;font-size:9.5pt}.pr span:first-child{min-width:150px;flex-shrink:0}.pr span:last-child{flex:1;font-weight:bold}
.bb{margin-bottom:12px;font-size:9.5pt}
.tw{border:2px solid #000;margin-bottom:8px}
.it{width:100%;border-collapse:collapse;font-size:9.5pt}.it th,.it td{border:1px solid #000;padding:4px 6px}.it th{font-weight:bold;text-align:center;background:#f0f0f0}
.tot{text-align:right;margin-bottom:8px;font-size:9.5pt}.tot p{margin:2px 0}.tl{font-weight:bold;font-size:11pt;border-top:1px solid #000;padding-top:4px;margin-top:4px}
.iw{margin:8px 0;font-size:9.5pt}
.at{margin:14px 0;font-size:9.5pt;line-height:1.4}
.sig{display:flex;justify-content:space-between;margin-top:24px;font-size:9.5pt}.sb{width:48%}.sl{display:flex;align-items:center;gap:6px;margin-top:22px}.sd{flex:1;border-bottom:1px solid #000;min-width:80px}.sn{white-space:nowrap}
.slb{font-weight:bold;margin-bottom:2px}
</style></head><body>
<div class="t">Акт оказанных услуг № ${esc(inv.number)} от ${formatRuDate(inv.date)} г.</div>
<div class="pb"><div class="pr"><span>Исполнитель:</span><span>${sl}</span></div><div class="pr"><span>Заказчик:</span><span>${bl}</span></div></div>
<div class="bb">Основание: ${basis}</div>
<div class="tw"><table class="it"><thead><tr><th style="width:5%">№</th><th style="width:53%">Наименование работ, услуг</th><th style="width:7%">Кол-во</th><th style="width:7%">Ед.</th><th style="width:12%">Цена</th><th style="width:12%">Сумма</th></tr></thead><tbody>${rows}</tbody></table></div>
<div class="tot"><p>Итого: ${fmt(inv.total)}</p><p>Без налога (НДС): —</p><p class="tl">Всего к оплате: ${fmt(inv.totalWithVat)}</p></div>
<div class="iw">Всего наименований ${inv.positions.length}, на сумму ${fmt(inv.totalWithVat)} руб.<br/>${numberToWords(Number(inv.totalWithVat))}</div>
<div class="at">Вышеперечисленные услуги выполнены полностью и в срок. Заказчик претензий по объему, качеству и срокам оказания услуг не имеет.</div>
<div class="sig"><div class="sb"><div class="slb">ИСПОЛНИТЕЛЬ</div><div class="sl"><span class="sd"></span><span class="sn">${esc(org.director||'')}</span></div></div><div class="sb"><div class="slb">ЗАКАЗЧИК</div><div class="sl"><span class="sd"></span><span class="sn">${esc(cp?.name||'')}</span></div></div></div>
</body></html>`;
}

async function htmlToPdf(html) {
  if (!BrowserWindow) {
    throw new Error('PDF generation requires Electron BrowserWindow — ensure app is running inside Electron');
  }
  const tmpFile = path.join(os.tmpdir(), `schetovod_${Date.now()}_${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmpFile, html, 'utf-8');
  let win = null;
  try {
    win = new BrowserWindow({
      show: false, width: 794, height: 1123,
      webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, javascript: false },
    });
    // Load via file:// protocol — most reliable in packaged Electron
    const fileUrl = 'file://' + tmpFile.replace(/\\/g, '/');
    await win.loadURL(fileUrl);
    // Wait for layout
    await new Promise(r => setTimeout(r, 800));
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    try { fs.unlinkSync(tmpFile); } catch(_) {}
  }
}

async function generatePDF(org, cp, invoice) {
  return htmlToPdf(invoiceHTML(org, cp, invoice));
}

async function generateActPDF(org, cp, invoice) {
  return htmlToPdf(actHTML(org, cp, invoice));
}

module.exports = { generatePDF, generateActPDF, invoiceHTML, actHTML };
