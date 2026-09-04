// Logo and QR code management for Билл-до
const LOGO_KEY = 'billdo_logo_base64';
const QR_URL_KEY = 'billdo_qr_url';
const LOGO_QR_ENABLED_KEY = 'billdo_logo_qr_enabled';

const LOGO_MAX_WIDTH = 200;
const LOGO_MAX_HEIGHT = 80;

export function isLogoQrEnabled(): boolean {
  return localStorage.getItem(LOGO_QR_ENABLED_KEY) === 'true';
}

export function setLogoQrEnabled(enabled: boolean) {
  localStorage.setItem(LOGO_QR_ENABLED_KEY, String(enabled));
}

export function getLogoBase64(): string | null {
  return localStorage.getItem(LOGO_KEY);
}

export function setLogoBase64(base64: string) {
  localStorage.setItem(LOGO_KEY, base64);
}

export function removeLogo() {
  localStorage.removeItem(LOGO_KEY);
}

export function getQrUrl(): string {
  return localStorage.getItem(QR_URL_KEY) || '';
}

export function setQrUrl(url: string) {
  localStorage.setItem(QR_URL_KEY, url);
}

// Validate logo dimensions
export function validateLogo(file: File): Promise<{ valid: boolean; error?: string; base64?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.width > LOGO_MAX_WIDTH || img.height > LOGO_MAX_HEIGHT) {
          resolve({
            valid: false,
            error: `Логотип слишком большой (${img.width}×${img.height}px). Максимум: ${LOGO_MAX_WIDTH}×${LOGO_MAX_HEIGHT}px. Уменьшите изображение.`,
          });
        } else {
          // Resize to fit within max dimensions while preserving aspect ratio
          const canvas = document.createElement('canvas');
          const scale = Math.min(LOGO_MAX_WIDTH / img.width, LOGO_MAX_HEIGHT / img.height, 1);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/png');
            resolve({ valid: true, base64 });
          } else {
            resolve({ valid: false, error: 'Ошибка обработки изображения' });
          }
        }
      };
      img.onerror = () => resolve({ valid: false, error: 'Не удалось загрузить изображение' });
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve({ valid: false, error: 'Ошибка чтения файла' });
    reader.readAsDataURL(file);
  });
}

// Generate QR code as base64 data URL
export async function generateQrCode(url: string): Promise<string> {
  try {
    const QRCode = await import('qrcode');
    return await QRCode.toDataURL(url, {
      width: 120,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    });
  } catch (e) {
    console.error('QR generation error:', e);
    return '';
  }
}

// Generate HTML for logo+QR block to insert after signatures
export async function generateLogoQrHtml(): Promise<string> {
  if (!isLogoQrEnabled()) return '';

  const logo = getLogoBase64();
  const qrUrl = getQrUrl();

  if (!logo && !qrUrl) return '';

  let qrBase64 = '';
  if (qrUrl) {
    qrBase64 = await generateQrCode(qrUrl);
  }

  return `
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;padding-top:12px;border-top:1px solid #ddd;">
  <div style="width:45%;">
    ${logo ? `<img src="${logo}" style="max-width:${LOGO_MAX_WIDTH}px;max-height:${LOGO_MAX_HEIGHT}px;object-fit:contain;" alt="Логотип" />` : ''}
  </div>
  <div style="width:45%;text-align:right;">
    ${qrBase64 ? `<img src="${qrBase64}" style="width:100px;height:100px;" alt="QR-код" />` : ''}
    ${qrUrl ? `<div style="font-size:8pt;color:#666;margin-top:2px;">${qrUrl}</div>` : ''}
  </div>
</div>`;
}
