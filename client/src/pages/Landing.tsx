import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ── SVG Icons (replacing emojis) ── */
const IconBolt = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
const IconFileSpreadsheet = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="12" y1="9" x2="12" y2="21"/></svg>
);
const IconBook = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
);
const IconBuilding = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
);
const IconShield = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
);
const IconGift = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
);

const FEATURES = [
  { icon: <IconBolt />, title: 'За минуту', desc: 'Заполняете форму — документ собирается автоматически. Без шаблонов и рутины.' },
  { icon: <IconFileSpreadsheet />, title: 'Excel и PDF', desc: 'Скачивайте счета в Excel с формулами или в PDF — один клик, готовый файл.' },
  { icon: <IconBook />, title: 'Журнал счетов', desc: 'Все выставленные счета в одном месте. Фильтры, статусы, аналитика по месяцам.' },
  { icon: <IconBuilding />, title: 'Несколько организаций', desc: 'Один аккаунт — несколько компаний. Переключайтесь без выхода из системы.' },
  { icon: <IconShield />, title: 'Безопасно', desc: 'Данные на защищённых серверах. Пароли зашифрованы. HTTPS, isolation по тенантам.' },
  { icon: <IconGift />, title: 'Бесплатный старт', desc: 'Один счёт бесплатно — чтобы попробовать. Дальше — подписка без сюрпризов.' },
];

const STEPS = [
  { num: '01', title: 'Регистрируетесь', desc: 'Бесплатно, за 10 секунд. Email и пароль — всё.' },
  { num: '02', title: 'Настраиваете реквизиты', desc: 'Данные вашей организации — один раз, навсегда.' },
  { num: '03', title: 'Создаёте счёт', desc: 'Покупатель, позиции, цены. Сумма считается сама.' },
  { num: '04', title: 'Скачиваете', desc: 'PDF, Excel или печать — документ за секунду.' },
];

const PLANS = [
  { name: 'Пробный', price: '0', period: '', features: ['1 счёт навсегда', '1 организация', 'Excel и PDF', 'Журнал счетов'], cta: 'Попробовать', highlight: false },
  { name: 'Базовый', price: '490', period: '/мес', features: ['100 счетов в месяц', '2 организации', 'Экспорт журнала', 'Приоритетная поддержка'], cta: 'Подключить', highlight: true },
  { name: 'Про', price: '990', period: '/мес', features: ['Безлимит счетов', '10 организаций', 'Все функции', 'Приоритетная поддержка'], cta: 'Подключить', highlight: false },
];

export function LandingPage() {
  const hero = useInView(0.1);
  const feat = useInView(0.1);
  const steps = useInView(0.1);
  const pricing = useInView(0.1);

  return (
    <div className="landing">
      {/* ── NAV ── */}
      <nav className="l-nav">
        <div className="l-nav-inner">
          <Link to="/" className="l-nav-brand">
            <div className="l-nav-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <span>Билдо</span>
          </Link>
          <div className="l-nav-links">
            <a href="#features">Возможности</a>
            <a href="#how">Как работает</a>
            <a href="#pricing">Тарифы</a>
          </div>
          <div className="l-nav-actions">
            <Link to="/login" className="l-btn l-btn-ghost">Войти</Link>
            <Link to="/register" className="l-btn l-btn-primary">Начать бесплатно</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={`l-hero ${hero.visible ? 'l-visible' : ''}`} ref={hero.ref}>
        <div className="l-hero-bg-orb l-orb-1" />
        <div className="l-hero-bg-orb l-orb-2" />
        <div className="l-hero-bg-orb l-orb-3" />
        <div className="l-hero-content">
          <div className="l-badge">Бесплатный старт · Без привязки карты</div>
          <h1>
            Счёт на оплату<br />
            <span className="l-hero-accent">за минуту.</span>
          </h1>
          <p className="l-hero-sub">
            Сервис для бухгалтеров и предпринимателей.<br />
            Заполняете форму — готовый документ собирается автоматически.
          </p>
          <div className="l-hero-actions">
            <Link to="/register" className="l-btn l-btn-primary l-btn-lg">
              Создать первый счёт
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
            <a href="#how" className="l-btn l-btn-outline l-btn-lg">Как это работает</a>
          </div>
        </div>

        <div className="l-hero-visual">
          <div className="l-invoice-mock">
            <div className="l-mock-chrome">
              <div className="l-mock-dots"><span /><span /><span /></div>
              <div className="l-mock-url">billdo.ru/invoice/142</div>
            </div>
            <div className="l-mock-body">
              <div className="l-mock-line l-mock-line-title">Счёт на оплату № 142 от 20.08.2026</div>
              <div className="l-mock-line l-mock-line-sm">Поставщик: ООО «Ваша Компания», ИНН 7701234567</div>
              <div className="l-mock-line l-mock-line-sm">Покупатель: ООО «Партнёр», ИНН 7709876543</div>
              <div className="l-mock-line l-mock-line-sm" style={{marginBottom: 14}}>Основание: Договор № 05-КУ/2024 от 01.03.2024 г.</div>
              <div className="l-mock-table">
                <div className="l-mock-row l-mock-row-head">
                  <span style={{gridColumn:'1'}}>№</span>
                  <span style={{gridColumn:'2'}}>Наименование</span>
                  <span style={{gridColumn:'3',textAlign:'right'}}>Сумма</span>
                </div>
                <div className="l-mock-row l-mock-row-data l-row-anim-1">
                  <span style={{gridColumn:'1'}}>1</span>
                  <span style={{gridColumn:'2'}}>Консультационные услуги по пожарной безопасности</span>
                  <span style={{gridColumn:'3',textAlign:'right'}}>50 000,00 ₽</span>
                </div>
                <div className="l-mock-row l-mock-row-data l-row-anim-2">
                  <span style={{gridColumn:'1'}}>2</span>
                  <span style={{gridColumn:'2'}}>Техническая поддержка и сопровождение</span>
                  <span style={{gridColumn:'3',textAlign:'right'}}>15 000,00 ₽</span>
                </div>
                <div className="l-mock-row l-mock-row-data l-row-anim-3">
                  <span style={{gridColumn:'1'}}>3</span>
                  <span style={{gridColumn:'2'}}>Аудит документации и экспертиза</span>
                  <span style={{gridColumn:'3',textAlign:'right'}}>25 500,00 ₽</span>
                </div>
              </div>
              <div className="l-mock-total">Итого к оплате: 90 500,00 ₽</div>
              <div style={{fontSize: 11, color: '#6B7B77', marginTop: 8, fontStyle: 'italic'}}>
                Всего наименований 3, на сумму 90 500 руб. 00 копеек
              </div>
              <div style={{display:'flex', justifyContent:'space-between', marginTop: 24, fontSize: 11, color: '#5A6B67'}}>
                <div>
                  <div style={{marginBottom: 28}}>Руководитель</div>
                  <div style={{display:'flex', alignItems:'center', gap: 6}}>
                    <span style={{flex:1, borderBottom:'1px solid #1B2A2E', minWidth: 60}} />
                    <span style={{whiteSpace:'nowrap', fontWeight: 600}}>Иванов И.И.</span>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{marginBottom: 28}}>Бухгалтер</div>
                  <div style={{display:'flex', alignItems:'center', gap: 6}}>
                    <span style={{whiteSpace:'nowrap', fontWeight: 600}}>Петрова А.С.</span>
                    <span style={{flex:1, borderBottom:'1px solid #1B2A2E', minWidth: 60}} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="l-float-badge l-float-1">
            <img src="/excel.png" alt="Excel" style={{width: 18, height: 18}} />
            Excel
          </div>
          <div className="l-float-badge l-float-2">
            <img src="/pdf.png" alt="PDF" style={{width: 18, height: 18}} />
            PDF
          </div>
          <div className="l-float-badge l-float-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            Готово
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div className="l-marquee-wrap">
        <div className="l-marquee">
          <div className="l-marquee-track">
            <span>Сервис в открытом доступе</span>
            <span className="l-marquee-dot" />
            <span>Создавайте счета бесплатно</span>
            <span className="l-marquee-dot" />
            <span>Excel · PDF · Печать</span>
            <span className="l-marquee-dot" />
            <span>Без привязки карты</span>
            <span className="l-marquee-dot" />
            <span>Сервис в открытом доступе</span>
            <span className="l-marquee-dot" />
            <span>Создавайте счета бесплатно</span>
            <span className="l-marquee-dot" />
            <span>Excel · PDF · Печать</span>
            <span className="l-marquee-dot" />
            <span>Без привязки карты</span>
            <span className="l-marquee-dot" />
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="features" className={`l-features ${feat.visible ? 'l-visible' : ''}`} ref={feat.ref}>
        <div className="l-container">
          <div className="l-section-header">
            <span className="l-section-tag">Возможности</span>
            <h2>Всё для работы<br />со счетами</h2>
            <p>От создания документа до аналитики — всё в одном месте</p>
          </div>
          <div className="l-features-grid">
            {FEATURES.map((f, i) => (
              <div key={i} className="l-feature-card" style={{ animationDelay: `${i * 0.07}s` }}>
                <div className="l-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className={`l-how ${steps.visible ? 'l-visible' : ''}`} ref={steps.ref}>
        <div className="l-container">
          <div className="l-section-header">
            <span className="l-section-tag">Как работает</span>
            <h2>Четыре шага<br />до готового счёта</h2>
          </div>
          <div className="l-steps-grid">
            {STEPS.map((s, i) => (
              <div key={i} className="l-step-card" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="l-step-num">{s.num}</div>
                <div className="l-step-line" />
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className={`l-pricing ${pricing.visible ? 'l-visible' : ''}`} ref={pricing.ref}>
        <div className="l-container">
          <div className="l-section-header">
            <span className="l-section-tag">Тарифы</span>
            <h2>Попробуйте бесплатно.<br />Растите когда нужно.</h2>
            <p>Один счёт навсегда бесплатно. Дальше — подписка без сюрпризов.</p>
          </div>
          <div className="l-plans">
            {PLANS.map((p, i) => (
              <div key={i} className={`l-plan ${p.highlight ? 'l-plan-highlight' : ''}`}>
                {p.highlight && <div className="l-plan-tag">Популярный</div>}
                <h3>{p.name}</h3>
                <div className="l-plan-price">
                  <span className="l-plan-currency">₽</span>
                  <span className="l-plan-amount">{p.price}</span>
                  {p.period && <span className="l-plan-period">{p.period}</span>}
                </div>
                <ul>
                  {p.features.map((f, j) => <li key={j}>{f}</li>)}
                </ul>
                <Link to="/register" className={`l-btn ${p.highlight ? 'l-btn-primary' : 'l-btn-outline'}`} style={{ width: '100%', justifyContent: 'center' }}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="l-cta">
        <div className="l-cta-orb l-cta-orb-1" />
        <div className="l-cta-orb l-cta-orb-2" />
        <div className="l-container l-cta-inner">
          <h2>Готовы создать первый счёт?</h2>
          <p>Бесплатная регистрация. Без привязки карты. 30 секунд.</p>
          <Link to="/register" className="l-btn l-btn-white l-btn-lg">
            Создать аккаунт бесплатно
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="l-footer">
        <div className="l-container">
          <div className="l-footer-grid">
            <div className="l-footer-col l-footer-about">
              <div className="l-footer-logo">
                <div className="l-nav-icon" style={{ width: 30, height: 30, borderRadius: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <span>Билдо</span>
              </div>
              <p className="l-footer-desc">Онлайн-сервис для выставления счетов на оплату. Создавайте профессиональные документы за минуту.</p>
            </div>
            <div className="l-footer-col">
              <h4>Продукт</h4>
              <a href="#features">Возможности</a>
              <a href="#pricing">Тарифы</a>
              <a href="#how">Как работает</a>
            </div>
            <div className="l-footer-col">
              <h4>Аккаунт</h4>
              <Link to="/login">Войти</Link>
              <Link to="/register">Регистрация</Link>
              <Link to="/dashboard">Дашборд</Link>
            </div>
            <div className="l-footer-col">
              <h4>Контакты</h4>
              <a href="mailto:hello@billdo.ru">hello@billdo.ru</a>
            </div>
          </div>
          <div className="l-footer-bottom">
            <span>© 2026 Билдо</span>
            <span className="l-footer-badge">Сделано с заботой о бухгалтерах</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
