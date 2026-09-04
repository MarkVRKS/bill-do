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
  { target: '', title: 'Добро пожаловать!', text: 'Давайте познакомимся с основными возможностями приложения за пару минут.', page: '/dashboard' },
  { target: '.nav-brand', title: 'Навигация', text: 'Нажмите на логотип, чтобы вернуться на главную страницу из любого раздела.', page: '/dashboard', position: 'bottom' },
  { target: '.nav-tabs .nav-tab:nth-child(1)', title: 'Дашборд', text: 'Здесь находится главная страница с общей статистикой вашего аккаунта.', page: '/dashboard', position: 'bottom' },
  { target: '.nav-tabs .nav-tab:nth-child(2)', title: 'Новый счёт', text: 'Перейдите сюда для создания нового счёта на оплату.', page: '/dashboard', position: 'bottom' },
  { target: '.journal-metric-card', title: 'Статистика', text: 'Здесь хранится вся сводка по счетам, актам, суммам и чекам.', page: '/dashboard', position: 'right' },
  { target: '', title: 'Создание счёта', text: 'Заполните форму слева — документ будет собираться справа в реальном времени.', page: '/invoice' },
  { target: '#invoiceNumber', title: 'Номер', text: 'Номер присваивается автоматически, но вы можете изменить его вручную.', page: '/invoice', position: 'bottom' },
  { target: '#invoiceDate', title: 'Дата', text: 'Укажите дату выставления счёта.', page: '/invoice', position: 'bottom' },
  { target: '#counterparty', title: 'Покупатель', text: 'Выберите покупателя из списка, который вы составили во вкладке «Настройки», или добавьте нового прямо здесь.', page: '/invoice', position: 'bottom' },
  { target: '#vatType', title: 'НДС', text: 'Выберите ставку НДС, если она применима к вашей деятельности.', page: '/invoice', position: 'bottom' },
  { target: '#positionsBody', title: 'Позиции', text: 'Здесь вы можете описать услугу, настроить количество, единицы измерения и цену за единицу. Программа сама подсчитает общую сумму, включая НДС (если он указан).', page: '/invoice', position: 'right' },
  { target: '.invoice-preview', title: 'Просмотр', text: 'По мере заполнения счёта вы можете видеть, как формируется ваш документ — всё обновляется в реальном времени.', page: '/invoice', position: 'left' },
  { target: '', title: 'Журнал', text: 'Здесь хранятся все ваши сгенерированные счета и акты.', page: '/journal' },
  { target: '.filter-bar', title: 'Фильтры', text: 'Применяйте различные фильтры для удобной навигации и поиска нужных счетов.', page: '/journal', position: 'bottom' },
  { target: '.journal-dashboard', title: 'Аналитика', text: 'Здесь отображается общая статистика: суммы счетов, их количество и текущие статусы.', page: '/journal', position: 'bottom' },
  { target: '', title: 'Настройки', text: 'Настройте здесь реквизиты своей организации, а также управляйте списком покупателей.', page: '/settings' },
  { target: '#org-name', title: 'Название', text: 'Здесь вы можете вписать полное наименование вашей организации.', page: '/settings', position: 'right' },
  { target: '#bank-name', title: 'Банк', text: 'Здесь вы можете вписать свои банковские реквизиты: название банка, БИК, корреспондентский и расчётный счёта.', page: '/settings', position: 'right' },
  { target: '.settings-mini-preview', title: 'Просмотр', text: 'Так выглядит ваш счёт.', page: '/settings', position: 'left' },
  { target: '.settings-actions', title: 'Действия', text: 'Здесь вы можете получить быстрый доступ к основным функциям сервиса.', page: '/settings', position: 'left' },
  { target: '.backup-dropzone', title: 'Бэкап', text: 'Здесь вы можете сохранить себе бэкап настроек, либо же загрузить настройки из бэкапа. Для продолжения вашей работы с нашим сервисом!', page: '/settings', position: 'left' },
  { target: '.journal-export-bar', title: 'Выгрузка документов', text: 'Здесь вы можете сохранить все свои генерированные файлы счетов и актов.', page: '/journal', position: 'bottom' },
  { target: '', title: 'Готово!', text: 'Теперь вы знаете основы! Создавайте счета и акты в пару кликов. Если захотите освежить память — гайд всегда доступен в настройках. Подробнее о возможностях приложения — во вкладке «О приложении».', page: '/dashboard' },
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
      const isMobile = window.innerWidth <= 640;

      if (!step?.target) {
        setCentered(true);
        setSpotStyle({});
        if (isMobile) {
          setCardStyle({ left: 16, right: 16, bottom: 16, top: 'auto', transform: 'none', width: 'auto' });
        } else {
          setCardStyle({ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' });
        }
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
            left: Math.max(4, r.left - SP),
            width: Math.min(r.width + SP * 2, window.innerWidth - 8),
            height: r.height + SP * 2,
          });

          if (isMobile) {
            // On mobile, always show card at bottom
            setCardStyle({ left: 16, right: 16, bottom: 16, top: 'auto', transform: 'none', width: 'auto' });
          } else {
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
          }
          requestAnimationFrame(() => { setVisible(true); busyRef.current = false; });
        }, 300);
      } else {
        setCentered(true);
        setSpotStyle({});
        if (isMobile) {
          setCardStyle({ left: 16, right: 16, bottom: 16, top: 'auto', transform: 'none', width: 'auto' });
        } else {
          setCardStyle({ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' });
        }
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
        const isMobile = window.innerWidth <= 640;
        setSpotStyle({
          top: r.top - SP,
          left: Math.max(4, r.left - SP),
          width: Math.min(r.width + SP * 2, window.innerWidth - 8),
          height: r.height + SP * 2,
        });
        if (isMobile) {
          setCardStyle({ left: 16, right: 16, bottom: 16, top: 'auto', transform: 'none', width: 'auto' });
        } else {
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
        }
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
