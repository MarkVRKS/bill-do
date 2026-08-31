const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const MONTHS_GENITIVE = ['', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function formatRuDate(d) { const [y,m,dd] = d.split('-'); return `${dd}.${m}.${y}`; }
function fmt(n) { return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n)); }
function numberToWords(num) {
  if (num === 0) return 'Ноль рублей 00 копеек';
  const ones=['','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
  const onesF=['','одна','две','три','четыре','пять','шесть','семь','восемь','девять'];
  const teens=['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const tens=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
  const hundreds=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
  function g(n,f){let r='';if(n>=100){r+=hundreds[Math.floor(n/100)]+' ';n%=100}if(n>=20){r+=tens[Math.floor(n/10)]+' ';n%=10}else if(n>=10)return r+teens[n-10]+' ';if(n>0)r+=(f?onesF:ones)[n]+' ';return r}
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

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getBasisText(invoice) {
  if (invoice.bases && invoice.bases.length > 0) {
    return invoice.bases.filter(b => b && b.trim()).join('; ');
  }
  return invoice.basis || '—';
}

async function generateExcel(org, cp, invoice) {
  const templatePath = path.join(__dirname, 'template.xlsx');
  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');

  const sl = `${org.name||''}, ИНН ${org.inn||''}, КПП ${org.kpp||''}, ${org.address||''}`;
  const bl = cp ? `${cp.name||'—'}, ${cp.address||''}${cp.ogrn?', ОГРН '+cp.ogrn:''}, ИНН/КПП ${cp.inn||'—'}/${cp.kpp||'—'}` : '—';
  const vl = invoice.vatType === 'none' ? 'Без налога (НДС)' : `НДС ${invoice.vatType}%:`;
  const vv = invoice.vatType === 'none' ? '—' : fmt(invoice.vatAmount);
  const title = `Счет на оплату № ${invoice.number} от ${formatRuDate(invoice.date)} г.`;

  let xml = sheetXml;
  xml = xml.split('{{TITLE}}').join(escXml(title));
  xml = xml.split('{{SUPPLIER_LINE}}').join(escXml(sl));
  xml = xml.split('{{BUYER}}').join(escXml(bl));
  xml = xml.split('{{BASIS}}').join(escXml(getBasisText(invoice)));
  xml = xml.split('{{DIRECTOR}}').join(escXml(org.director || ''));
  xml = xml.split('{{ACCOUNTANT}}').join(escXml(org.accountant || ''));
  xml = xml.split('{{VAT_LABEL}}').join(escXml(vl));
  xml = xml.split('{{VAT_VALUE}}').join(escXml(vv));
  xml = xml.split('{{ITEMS_SUMMARY}}').join(escXml(`Всего наименований ${invoice.positions.length}, на сумму ${fmt(invoice.totalWithVat)} руб.`));
  xml = xml.split('{{SUM_IN_WORDS}}').join(escXml(numberToWords(Number(invoice.totalWithVat))));

  // Data row placeholders (single row in template)
  const pos = invoice.positions[0];
  if (pos) {
    xml = xml.split('{{ITEM_NUM}}').join(String(pos.sortOrder));
    xml = xml.split('{{ITEM_NAME}}').join(escXml(pos.name));
    xml = xml.split('{{ITEM_QTY}}').join(String(pos.quantity));
    xml = xml.split('{{ITEM_UNIT}}').join(escXml(pos.unit));
    xml = xml.split('{{ITEM_PRICE}}').join(String(pos.price));
  }

  zip.file('xl/worksheets/sheet1.xml', xml);
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buffer;
}

module.exports = { generateExcel };
