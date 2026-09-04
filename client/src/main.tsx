import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initLocalDb } from './lib/local-db'
import App from './App.tsx'

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isElectron = !!(window as any).electronAPI?.isElectron;

async function start() {
  // Initialize local database on mobile
  if (isMobile && !isElectron) {
    try {
      await initLocalDb();
      console.log('DB ready');
    } catch (e) {
      console.error('DB init failed:', e);
      // Continue anyway - app will work with empty state
    }
  }

  // Hide splash screen
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 500);
  }

  // Render app
  createRoot(document.getElementById('root')!).render(
    <StrictMode><App /></StrictMode>,
  );
}

start();
