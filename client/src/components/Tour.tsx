import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Tour.css';

interface TourStep {
  target: string;
  title: string;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  page?: string;
}

const STEPS: TourStep[] = [
  { target: '', title: 'Добро пожаловать!', text: 'Покажем главное за минуту.', page: '/dashboard' },
  { target: '.nav-brand', title: 'Навигация', text: 'Логотип — кнопка возврата.', page: '/dashboard', position: 'bottom' },
  { target: '.nav-tabs .nav-tab:nth-child(1)', title: 'Дашборд', text: 'Главная со статистикой.', page: '/dashboard', position: 'bottom' },
  { target: '.nav-tabs .nav-tab:nth-child(2)', title: 'Новый счёт', text: 'Создание счёта.', page: '/dashboard', position: 'bottom' },
  { target: '.journal-metric-card', title: 'Статистика', text: 'Сводка: счета, сумма, чек.', page: '/dashboard', position: 'right' },
  { target: '', title: 'Создание счёта', text: 'Заполняете форму — документ собирается.', page: '/invoice' },
  { target: '#invoiceNumber', title: 'Номер', text: 'Автоматический.', page: '/invoice', position: 'bottom' },
  { target: '#invoiceDate', title: 'Дата', text: 'Дата выставления.', page: '/invoice', position: 'bottom' },
  { target: '#counterparty', title: 'Покупатель', text: 'Из списка.', page: '/invoice', position: 'bottom' },
  { target: '#vatType', title: 'НДС', text: 'Ставка.', page: '/invoice', position: 'bottom' },
  { target: '#positionsBody', title: 'Позиции', text: 'Услуги. Сумма сама.', page: '/invoice', position: 'right' },
  { target: '.invoice-preview', title: 'Просмотр', text: 'Обновляется realtime.', page: '/invoice', position: 'left' },
  { target: '', title: 'Журнал', text: 'Все счета.', page: '/journal' },
  { target: '.filter-bar', title: 'Фильтры', text: 'Поиск.', page: '/journal', position: 'bottom' },
  { target: '.journal-dashboard', title: 'Аналитика', text: 'Сумма, чек.', page: '/journal', position: 'bottom' },
  { target: '', title: 'Настройки', text: 'Реквизиты.', page: '/settings' },
  { target: '#org-name', title: 'Название', text: 'Наименование.', page: '/settings', position: 'right' },
  { target: '#bank-name', title: 'Банк', text: 'Банк.', page: '/settings', position: 'right' },
  { target: '.settings-mini-preview', title: 'Просмотр', text: 'Как выглядит счёт.', page: '/settings', position: 'left' },
  { target: '.settings-actions', title: 'Действия', text: 'Быстрый доступ.', page: '/settings', position: 'left' },
  { target: '.backup-dropzone', title: 'Бэкап', text: 'Здесь вы можете сохранить себе бэкап настроек, либо же загрузить настройки из бэкапа. Для продолжения вашей работы с нашим сервисом!', page: '/settings', position: 'left' },
  { target: '.journal-export-bar', title: 'Выгрузка документов', text: 'Здесь вы можете сохранить все свои генерированные файлы счетов и актов.', page: '/journal', position: 'bottom' },
  { target: '', title: 'Готово!', text: 'Создавайте счета!', page: '/dashboard' },
];

const SP = 6;

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotStyle, setSpotStyle] = useState<React.CSSProperties>({});
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});
  const [centered, setCentered] = useState(false);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const busyRef = useRef(false);
  const rafRef = useRef(0);

  const step = STEPS[stepIndex];

  // Navigate
  useEffect(() => {
    if (!active || !step?.page || location.pathname === step.page) return;
    navigate(step.page);
  }, [active, step, location.pathname, navigate]);

  // Find + position
  const resolve = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setVisible(false);

    const doResolve = () => {
      if (!step?.target) {
        setCentered(true);
        setSpotStyle({});
        setCardStyle({ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' });
        requestAnimationFrame(() => { setVisible(true); busyRef.current = false; });
        return;
      }

      const el = document.querySelector(step.target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const r = el.getBoundingClientRect();
          setCentered(false);
          setSpotStyle({
            top: r.top - SP,
            left: r.left - SP,
            width: r.width + SP * 2,
            height: r.height + SP * 2,
          });
          // Card position
          const cw = 360, ch = 200, g = 16;
          let ct: number, cl: number;
          const pos = step.position || 'bottom';
          if (pos === 'right') { cl = r.right + g; ct = r.top + r.height / 2 - ch / 2; }
          else if (pos === 'left') { cl = r.left - cw - g; ct = r.top + r.height / 2 - ch / 2; }
          else if (pos === 'bottom') { ct = r.bottom + g; cl = r.left + r.width / 2 - cw / 2; }
          else { ct = r.top - ch - g; cl = r.left + r.width / 2 - cw / 2; }
          cl = Math.max(12, Math.min(cl, window.innerWidth - cw - 12));
          ct = Math.max(12, Math.min(ct, window.innerHeight - ch - 12));
          setCardStyle({ top: ct, left: cl });
          requestAnimationFrame(() => { setVisible(true); busyRef.current = false; });
        }, 300);
      } else {
        setCentered(true);
        setSpotStyle({});
        setCardStyle({ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' });
        requestAnimationFrame(() => { setVisible(true); busyRef.current = false; });
      }
    };

    setTimeout(doResolve, 100);
  }, [step]);

  useEffect(() => { if (active) resolve(); }, [active, stepIndex, resolve]);

  // Scroll/resize
  useEffect(() => {
    if (!active || !step?.target || centered) return;
    const h = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const el = document.querySelector(step.target);
        if (!el) return;
        const r = el.getBoundingClientRect();
        setSpotStyle({ top: r.top - SP, left: r.left - SP, width: r.width + SP * 2, height: r.height + SP * 2 });
        const cw = 360, ch = 200, g = 16;
        const pos = step.position || 'bottom';
        let ct: number, cl: number;
        if (pos === 'right') { cl = r.right + g; ct = r.top + r.height / 2 - ch / 2; }
        else if (pos === 'left') { cl = r.left - cw - g; ct = r.top + r.height / 2 - ch / 2; }
        else if (pos === 'bottom') { ct = r.bottom + g; cl = r.left + r.width / 2 - cw / 2; }
        else { ct = r.top - ch - g; cl = r.left + r.width / 2 - cw / 2; }
        cl = Math.max(12, Math.min(cl, window.innerWidth - cw - 12));
        ct = Math.max(12, Math.min(ct, window.innerHeight - ch - 12));
        setCardStyle({ top: ct, left: cl });
      });
    };
    window.addEventListener('scroll', h, { passive: true });
    window.addEventListener('resize', h, { passive: true });
    return () => { window.removeEventListener('scroll', h); window.removeEventListener('resize', h); cancelAnimationFrame(rafRef.current); };
  }, [active, step, centered]);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setActive(true);
    setVisible(false);
    setCentered(true);
    setSpotStyle({});
    setCardStyle({ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' });
  }, []);

  const next = useCallback(() => {
    setVisible(false);
    if (stepIndex < STEPS.length - 1) setTimeout(() => setStepIndex(stepIndex + 1), 250);
    else setTimeout(() => setActive(false), 200);
  }, [stepIndex]);

  const prev = useCallback(() => {
    setVisible(false);
    if (stepIndex > 0) setTimeout(() => setStepIndex(stepIndex - 1), 250);
  }, [stepIndex]);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => setActive(false), 200);
  }, []);

  useEffect(() => {
    (window as any).__startTour = startTour;
    return () => { delete (window as any).__startTour; };
  }, [startTour]);

  if (!active) return <>{children}</>;

  const spotCN = `tour-spotlight${centered ? ' center' : ''}${visible ? ' active' : ''}`;
  const cardCN = `tour-card${centered ? ' center' : ''}${visible ? ' active' : ''}`;

  return (
    <>
      {children}
      <div className={`tour-overlay${visible ? ' active' : ''}`} onClick={close} />
      <div className={spotCN} style={centered ? undefined : spotStyle} />
      <div className={cardCN} style={centered ? undefined : cardStyle} onClick={e => e.stopPropagation()}>
        <div className="tour-card-eyebrow">Шаг {stepIndex + 1} из {STEPS.length}</div>
        <div className="tour-card-title">{step?.title}</div>
        <div className="tour-card-text">{step?.text}</div>
        <div className="tour-card-progress">
          {STEPS.map((_, i) => <span key={i} className={`tour-dot ${i < stepIndex ? 'done' : ''} ${i === stepIndex ? 'current' : ''}`} />)}
        </div>
        <div className="tour-card-footer">
          <div className="tour-card-footer-left">
            {stepIndex > 0 && <button className="btn btn-sm btn-secondary" onClick={prev}>Назад</button>}
            <button className="btn btn-sm btn-primary" onClick={next}>
              {stepIndex === STEPS.length - 1 ? 'Готово' : 'Далее'}
            </button>
          </div>
          <button className="tour-skip" onClick={close}>Пропустить</button>
        </div>
      </div>
    </>
  );
}

export function startGlobalTour() { (window as any)?.__startTour?.(); }
