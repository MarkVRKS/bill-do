import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.billdo.app',
  appName: 'Билл-до',
  webDir: 'dist',
  server: {
    allowNavigation: ['*'],
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#1B2A2E',
  },
};

export default config;
