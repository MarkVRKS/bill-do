import { useState, useRef, useEffect, useCallback } from 'react';
import './About.css';

const FEATURES = [
  { icon: 'doc', title: 'Счета за минуту', desc: 'Создавайте профессиональные счета на оплату с предпросмотрем в реальном времени', color: 'var(--accent-ink)' },
  { icon: 'file', title: 'PDF и Excel', desc: 'Скачивание в форматах PDF и XLSX с правильным форматированием', color: '#1A56DB' },
  { icon: 'check', title: 'Акты оказанных услуг', desc: 'Автоматическая генерация актов на основе данных счета', color: '#0D9488' },
  { icon: 'list', title: 'Журнал документов', desc: 'Все счета и акты в одном месте с фильтрами и поиском', color: '#7C3AED' },
  { icon: 'users', title: 'Покупатели', desc: 'База покупателей с реквизитами и основаниями (договорами)', color: '#D97706' },
  { icon: 'building', title: 'Несколько организаций', desc: 'Управляйте счетами для разных юридических лиц', color: '#059669' },
  { icon: 'calc', title: 'НДС', desc: 'Поддержка НДС 0%, 10%, 20%, 22%', color: '#DC2626' },
  { icon: 'lock', title: 'Конфиденциальность', desc: 'Все данные хранятся только на вашем компьютере', color: '#4338CA' },
];

function FeatureIcon({ type, color }: { type: string; color: string }) {
  const svgProps = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'doc': return <svg {...svgProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    case 'file': return <svg {...svgProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="12" width="8" height="6" rx="1"/></svg>;
    case 'check': return <svg {...svgProps}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
    case 'list': return <svg {...svgProps}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>;
    case 'users': return <svg {...svgProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'building': return <svg {...svgProps}><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>;
    case 'calc': return <svg {...svgProps}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
    case 'lock': return <svg {...svgProps}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    default: return null;
  }
}

const TECH_ITEMS = [
  { name: 'Electron', desc: 'Десктопное приложение' },
  { name: 'React', desc: 'Интерфейс' },
  { name: 'Node.js', desc: 'Серверная логика' },
  { name: 'TypeScript', desc: 'Надёжная типизация' },
];

function TechOrbit() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const draggingRef = useRef<number | null>(null);
  const dragStartAngleRef = useRef(0);
  const dragItemStartAngleRef = useRef(0);
  const velocityRef = useRef(0);
  const lastAngleRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(0);
  const [positions, setPositions] = useState<{ x: number; y: number }[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);

  const RADIUS = 100;
  const COUNT = TECH_ITEMS.length;

  const getPositions = useCallback((angle: number) => {
    return Array.from({ length: COUNT }, (_, i) => {
      const a = angle + (i * 2 * Math.PI) / COUNT;
      return { x: Math.cos(a) * RADIUS, y: Math.sin(a) * RADIUS };
    });
  }, [RADIUS, COUNT]);

  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;
      if (draggingRef.current === null) {
        // Apply velocity decay
        velocityRef.current *= 0.97;
        if (Math.abs(velocityRef.current) < 0.0001) velocityRef.current = 0;
        angleRef.current += 0.008 + velocityRef.current;
      }
      setPositions(getPositions(angleRef.current));
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [getPositions]);

  const getAngle = (clientX: number, clientY: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return 0;
    const rect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx);
  };

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = index;
    setDragging(index);
    dragStartAngleRef.current = getAngle(e.clientX, e.clientY);
    dragItemStartAngleRef.current = angleRef.current + (index * 2 * Math.PI) / COUNT;
    lastAngleRef.current = dragStartAngleRef.current;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingRef.current === null) return;
    const currentAngle = getAngle(e.clientX, e.clientY);
    const delta = currentAngle - dragStartAngleRef.current;
    angleRef.current = dragItemStartAngleRef.current - delta - (draggingRef.current * 2 * Math.PI) / COUNT;

    const now = Date.now();
    const dt = now - lastTimeRef.current;
    if (dt > 0) {
      velocityRef.current = (lastAngleRef.current - currentAngle) / dt * 0.5;
    }
    lastAngleRef.current = currentAngle;
    lastTimeRef.current = now;
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
    setDragging(null);
  };

  return (
    <div className="about-tech-orbit-wrap">
      <div ref={wrapRef} className="about-tech-orbit" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
        {TECH_ITEMS.map((t, i) => (
          <div
            key={i}
            className={`about-tech-orbit-item${dragging === i ? ' dragging' : ''}`}
            style={{
              transform: `translate(${positions[i]?.x || 0}px, ${positions[i]?.y || 0}px)`,
              transition: dragging === i ? 'none' : undefined,
            }}
            onPointerDown={(e) => handlePointerDown(e, i)}
          >
            <div className="about-tech-circle">
              <div className="about-tech-circle-name">{t.name}</div>
              <div className="about-tech-circle-desc">{t.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AboutPage() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  return (
    <>
      {/* Hero */}
      <div className="about-hero">
        <svg className="about-hero-pattern" width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, opacity: 0.03, pointerEvents: 'none' }}>
          <defs>
            <pattern id="hero-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M20 0L40 20L20 40L0 20Z" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-pattern)"/>
        </svg>
        
        <div className="about-hero-content">
          <div className="about-hero-logo">
            <div className="about-hero-logo-icon" style={{ borderRadius: '50%', overflow: 'hidden' }}>
              <img src="./billdo.png" alt="Билл-до" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h1 className="about-hero-title">Билл-до</h1>
          </div>
          <p className="about-hero-sub">Профессиональные счета на оплату за минуту</p>
          <a href="https://bill-do.ru" target="_blank" rel="noopener noreferrer" className="about-hero-link">bill-do.ru</a>
        </div>
      </div>

      {/* Features */}
      <div className="card about-section">
        <div className="about-section-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <h2>Возможности</h2>
        </div>
        <div className="about-features">
          {FEATURES.map((item, i) => (
            <div
              key={i}
              className={`about-feature ${hoveredFeature === i ? 'about-feature--active' : ''}`}
              onMouseEnter={() => setHoveredFeature(i)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <div className="about-feature-icon" style={{ background: `${item.color}10`, color: item.color }}>
                <FeatureIcon type={item.icon} color={item.color} />
              </div>
              <div className="about-feature-text">
                <strong>{item.title}</strong>
                <span>{item.desc}</span>
              </div>
              <div className="about-feature-glow" style={{ background: item.color }} />
            </div>
          ))}
        </div>
      </div>

      {/* Team */}
      <div className="card about-section">
        <div className="about-section-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <h2>Команда</h2>
        </div>
        <div className="about-team">
          <div className="about-team-member">
            <div className="about-member-avatar" style={{ background: 'var(--accent-ink)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="about-member-info">
              <div className="about-member-name">Галактион Павлович</div>
              <div className="about-member-role">Руководитель</div>
              <div className="about-member-org">Агентство «Контент Мафия»</div>
              <a href="https://landos-gp-pi.vercel.app/" target="_blank" rel="noopener noreferrer" className="about-member-link">
                landos-gp-pi.vercel.app
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          </div>

          <div className="about-team-member">
            <div className="about-member-avatar" style={{ background: '#1A56DB' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="about-member-info">
              <div className="about-member-name">MarkVRKS</div>
              <div className="about-member-role">Разработчик</div>
              <a href="https://t.me/usakso" target="_blank" rel="noopener noreferrer" className="about-member-link about-member-link--tg">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                Телеграм: @usakso
              </a>
            </div>
          </div>

          <div className="about-team-member">
            <div className="about-member-avatar" style={{ background: '#059669' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="about-member-info">
              <div className="about-member-name">Александр Бобров</div>
              <div className="about-member-role">СММ-специалист</div>
              <a href="https://t.me/the_sany19" target="_blank" rel="noopener noreferrer" className="about-member-link about-member-link--tg">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                Телеграм: @the_sany19
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Tech */}
      <div className="card about-section">
        <div className="about-section-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          <h2>Технологии</h2>
        </div>
        <TechOrbit />
      </div>

      {/* Footer */}
      <div className="card about-section about-footer">
        <p>Сделано агентством <strong>«Контент Мафия»</strong></p>
        <p className="about-footer-small">Все данные хранятся локально у вас на компьютере. Сервис никак не сможет передать информацию третьим лицам.</p>
      </div>
    </>
  );
}
