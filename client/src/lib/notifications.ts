// Notification utility with sound support
const NOTIFICATION_PREF_KEY = 'billdo_notifications_enabled';

export function isNotificationsEnabled(): boolean {
  const val = localStorage.getItem(NOTIFICATION_PREF_KEY);
  return val === null ? true : val === 'true';
}

export function setNotificationsEnabled(enabled: boolean) {
  localStorage.setItem(NOTIFICATION_PREF_KEY, String(enabled));
}

// Generate a pleasant notification sound using Web Audio API
function playNotificationSound(type: 'success' | 'info' | 'alert' = 'success') {
  if (!isNotificationsEnabled()) return;

  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Pleasant two-tone chime
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'alert') {
      // Attention tone
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.15); // C5
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Soft info tone
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Audio not available
  }
}

export type NotificationType = 'invoice_created' | 'backup_created' | 'backup_loaded' | 'org_created' | 'cp_created' | 'status_changed' | 'info';

interface NotificationConfig {
  message: string;
  sound: boolean;
  soundType: 'success' | 'info' | 'alert';
  toastType: 'success' | 'info' | 'error';
}

const NOTIFICATION_CONFIGS: Record<NotificationType, (detail?: string) => NotificationConfig> = {
  invoice_created: (detail) => ({
    message: detail || 'Счёт создан',
    sound: true,
    soundType: 'success',
    toastType: 'success',
  }),
  backup_created: () => ({
    message: 'Бэкап сохранён',
    sound: true,
    soundType: 'success',
    toastType: 'success',
  }),
  backup_loaded: (detail) => ({
    message: detail || 'Данные загружены из бэкапа',
    sound: true,
    soundType: 'success',
    toastType: 'success',
  }),
  org_created: (detail) => ({
    message: detail || 'Организация создана',
    sound: true,
    soundType: 'success',
    toastType: 'success',
  }),
  cp_created: (detail) => ({
    message: detail || 'Покупатель добавлен',
    sound: true,
    soundType: 'success',
    toastType: 'success',
  }),
  status_changed: (detail) => ({
    message: detail || 'Статус обновлён',
    sound: true,
    soundType: 'info',
    toastType: 'info',
  }),
  info: (detail) => ({
    message: detail || '',
    sound: true,
    soundType: 'info',
    toastType: 'info',
  }),
};

export function showNotification(type: NotificationType, detail?: string): { msg: string; type: string } | null {
  if (!isNotificationsEnabled()) return null;

  const config = NOTIFICATION_CONFIGS[type](detail);
  if (config.sound) {
    playNotificationSound(config.soundType);
  }
  return { msg: config.message, type: config.toastType };
}
