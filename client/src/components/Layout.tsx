import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';

function NavTooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="nav-tooltip-wrap" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && <div className="nav-tooltip">{text}</div>}
    </div>
  );
}

export function Layout() {
  return (
    <>
      <nav className="nav">
        <Link to="/dashboard" className="nav-brand">
          <div className="nav-brand-icon" style={{ borderRadius: '50%', overflow: 'hidden', width: 28, height: 28 }}>
            <img src="./billdo.png" alt="Билдо" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          Билдо
        </Link>
        <div className="nav-tabs">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`} end>
            <NavTooltip text="Обзор статистики и метрик">Дашборд</NavTooltip>
          </NavLink>
          <NavLink to="/invoice" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
            <NavTooltip text="Создать новый счёт на оплату">Новый счёт</NavTooltip>
          </NavLink>
          <NavLink to="/journal" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
            <NavTooltip text="Все выставленные счета">Журнал</NavTooltip>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
            <NavTooltip text="Настройки организации и аккаунта">Настройки</NavTooltip>
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
            <NavTooltip text="Информация о приложении">О приложении</NavTooltip>
          </NavLink>
        </div>
      </nav>
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}
