import { useState } from 'react';
import { setServerUrl } from '../api/client';

export function SetupPage({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleConnect() {
    if (!url.trim()) { setError('Введите адрес сервера'); return; }
    setChecking(true);
    setError('');
    try {
      const clean = url.trim().replace(/\/+$/, '');
      const res = await fetch(`${clean}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        setServerUrl(clean);
        onDone();
      } else {
        setError('Сервер не отвечает');
      }
    } catch {
      setError('Не удалось подключиться. Проверьте адрес.');
    }
    setChecking(false);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: '#F3F2ED', fontFamily: 'Inter, sans-serif'
    }}>
      <img src="/billdo.png" alt="Билл-до" style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 20 }} />
      <h1 style={{ fontFamily: 'Lora, serif', fontSize: 28, fontWeight: 600, color: '#1B2A2E', margin: '0 0 8px' }}>Билл-до</h1>
      <p style={{ fontSize: 14, color: '#6B7B77', margin: '0 0 32px', textAlign: 'center' }}>
        Подключитесь к серверу для начала работы
      </p>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#1B2A2E', display: 'block', marginBottom: 6 }}>
          Адрес сервера
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-server.com"
          style={{
            width: '100%', padding: '12px 14px', fontSize: 16,
            border: '1px solid #D4E4DE', borderRadius: 12,
            outline: 'none', boxSizing: 'border-box',
            fontFamily: 'Inter, sans-serif'
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
        />
        {error && <p style={{ color: '#DC2626', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
        <button
          onClick={handleConnect}
          disabled={checking}
          style={{
            width: '100%', marginTop: 16, padding: '14px',
            background: '#1B2A2E', color: '#fff', border: 'none',
            borderRadius: 12, fontSize: 15, fontWeight: 600,
            cursor: checking ? 'wait' : 'pointer',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {checking ? 'Проверка...' : 'Подключиться'}
        </button>
      </div>
    </div>
  );
}
