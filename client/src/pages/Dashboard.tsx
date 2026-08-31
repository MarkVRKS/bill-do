import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const MONTHS = ['', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const MONTHS_FULL = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const STATUS_LABELS: Record<string, string> = { draft: 'Черновик', sent: 'Выставлен', paid: 'Оплачен', overdue: 'Просрочен' };

function fmt(n: string | number) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n));
}

function fmtShort(n: string | number) {
  const val = Number(n);
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('ru-RU').format(val);
}

interface Invoice {
  id: string; number: string; date: string; counterpartyName: string | null;
  total: string; status: string; serviceMonth: number; serviceYear: number;
  createdAt: string;
}

export function DashboardPage() {
  const [monthly, setMonthly] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [counterparties, setCounterparties] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [statsRes, invoicesRes, cpRes] = await Promise.all([
        api.getInvoiceStats(),
        api.getInvoices(),
        api.getCounterparties(),
      ]);
      setMonthly(statsRes.monthly || []);
      setRecentInvoices(invoicesRes.invoices.slice(0, 5));
      setAllInvoices(invoicesRes.invoices);
      setCounterparties(cpRes.counterparties);
    } catch {}
  }

  // Computed metrics
  const totalSum = allInvoices.reduce((s, inv) => s + Number(inv.total || 0), 0);
  const counts = { paid: 0, sent: 0, draft: 0, overdue: 0 };
  allInvoices.forEach(inv => { (counts as any)[inv.status] = ((counts as any)[inv.status] || 0) + 1; });

  const paidSum = allInvoices.filter(i => i.status === 'paid').reduce((s, inv) => s + Number(inv.total || 0), 0);
  const pendingSum = allInvoices.filter(i => i.status === 'sent' || i.status === 'draft').reduce((s, inv) => s + Number(inv.total || 0), 0);
  const overdueSum = allInvoices.filter(i => i.status === 'overdue').reduce((s, inv) => s + Number(inv.total || 0), 0);

  // Top counterparties
  const cpStats: Record<string, { name: string; count: number; sum: number }> = {};
  allInvoices.forEach(inv => {
    const name = inv.counterpartyName || '—';
    if (!cpStats[name]) cpStats[name] = { name, count: 0, sum: 0 };
    cpStats[name].count++;
    cpStats[name].sum += Number(inv.total || 0);
  });
  const topCps = Object.values(cpStats).sort((a, b) => b.sum - a.sum).slice(0, 5);

  // Current month stats
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const thisMonthInvoices = allInvoices.filter(i => i.serviceMonth === currentMonth && i.serviceYear === currentYear);
  const thisMonthSum = thisMonthInvoices.reduce((s, inv) => s + Number(inv.total || 0), 0);

  // Previous month
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonthInvoices = allInvoices.filter(i => i.serviceMonth === prevMonth && i.serviceYear === prevMonthYear);
  const prevMonthSum = prevMonthInvoices.reduce((s, inv) => s + Number(inv.total || 0), 0);

  const monthDiff = prevMonthSum > 0 ? ((thisMonthSum - prevMonthSum) / prevMonthSum * 100) : 0;

  const maxSum = Math.max(...monthly.map((m) => Number(m.sum)), 1);

  return (
    <>
      <div className="page-hero">
        <h1>Добро пожаловать <em>в Билдо.</em></h1>
        <div className="page-hero-sub">Управляйте счетами на оплату из одного места</div>
      </div>

      {/* Main metrics */}
      <div className="dashboard-metrics">
        <div className="dash-metric-card primary">
          <div className="dash-metric-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div className="dash-metric-body">
            <div className="dash-metric-label">Общая сумма счетов</div>
            <div className="dash-metric-value">{fmtShort(totalSum)} ₽</div>
            <div className="dash-metric-sub">Всего: {fmt(totalSum)} ₽</div>
          </div>
        </div>

        <div className="dash-metric-card">
          <div className="dash-metric-icon green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="dash-metric-body">
            <div className="dash-metric-label">Оплачено</div>
            <div className="dash-metric-value">{fmtShort(paidSum)} ₽</div>
            <div className="dash-metric-sub">{counts.paid} {counts.paid === 1 ? 'счёт' : counts.paid < 5 ? 'счёта' : 'счетов'}</div>
          </div>
        </div>

        <div className="dash-metric-card">
          <div className="dash-metric-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="dash-metric-body">
            <div className="dash-metric-label">Ожидает оплаты</div>
            <div className="dash-metric-value">{fmtShort(pendingSum)} ₽</div>
            <div className="dash-metric-sub">{counts.sent + counts.draft} на сумму</div>
          </div>
        </div>

        <div className="dash-metric-card">
          <div className="dash-metric-icon red">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="dash-metric-body">
            <div className="dash-metric-label">Просрочено</div>
            <div className="dash-metric-value">{counts.overdue}</div>
            <div className="dash-metric-sub">{overdueSum > 0 ? `${fmtShort(overdueSum)} ₽` : 'Всё в порядке'}</div>
          </div>
        </div>
      </div>

      {/* Second row: this month + average + counterparties */}
      <div className="dashboard-metrics" style={{ marginTop: 16 }}>
        <div className="dash-metric-card compact">
          <div className="dash-metric-body">
            <div className="dash-metric-label">Этот месяц</div>
            <div className="dash-metric-value">{fmt(thisMonthSum)} ₽</div>
            <div className={`dash-metric-trend ${monthDiff >= 0 ? 'up' : 'down'}`}>
              {monthDiff >= 0 ? '↑' : '↓'} {Math.abs(monthDiff).toFixed(0)}% к прошлому
            </div>
          </div>
        </div>

        <div className="dash-metric-card compact">
          <div className="dash-metric-body">
            <div className="dash-metric-label">Средний чек</div>
            <div className="dash-metric-value">{allInvoices.length ? fmt(totalSum / allInvoices.length) : '—'} ₽</div>
            <div className="dash-metric-sub">по {allInvoices.length} счетам</div>
          </div>
        </div>

        <div className="dash-metric-card compact">
          <div className="dash-metric-body">
            <div className="dash-metric-label">Покупателей</div>
            <div className="dash-metric-value">{counterparties.length}</div>
            <div className="dash-metric-sub">уникальных контрагентов</div>
          </div>
        </div>

        <div className="dash-metric-card compact">
          <div className="dash-metric-body">
            <div className="dash-metric-label">Всего счетов</div>
            <div className="dash-metric-value">{allInvoices.length}</div>
            <div className="dash-metric-sub">{MONTHS_FULL[currentMonth]} {currentYear}</div>
          </div>
        </div>

        <div className="dash-metric-card compact">
          <div className="dash-metric-body">
            <div className="dash-metric-label">Актов доступно</div>
            <div className="dash-metric-value">{allInvoices.length}</div>
            <div className="dash-metric-sub">по каждому счёту</div>
          </div>
        </div>
      </div>

      {/* Chart + Top buyers side by side */}
      <div className="dashboard-row" style={{ marginTop: 22 }}>
        {monthly.length > 0 && (
          <div className="card" style={{ flex: 2, marginBottom: 0 }}>
            <div className="card-header">
              <h3>Динамика по месяцам</h3>
            </div>
            <div className="dash-chart">
              {monthly.map((m, i) => {
                const pct = Math.max(4, Math.round((Number(m.sum) / maxSum) * 100));
                return (
                  <div key={i} className="dash-chart-col">
                    <div className="dash-chart-bar-wrap">
                      <div
                        className="dash-chart-bar"
                        style={{ height: `${pct}%` }}
                        title={`${MONTHS_FULL[m.month]} ${m.year}: ${fmt(m.sum)} ₽`}
                      />
                    </div>
                    <div className="dash-chart-label">{MONTHS[m.month]}</div>
                    <div className="dash-chart-value">{fmtShort(m.sum)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {topCps.length > 0 && (
          <div className="card" style={{ flex: 1, marginBottom: 0 }}>
            <div className="card-header">
              <h3>Топ покупателей</h3>
            </div>
            <div className="dash-top-cps">
              {topCps.map((cp, i) => (
                <div key={i} className="dash-top-cp">
                  <div className="dash-top-cp-rank">{i + 1}</div>
                  <div className="dash-top-cp-info">
                    <div className="dash-top-cp-name">{cp.name}</div>
                    <div className="dash-top-cp-meta">{cp.count} {cp.count === 1 ? 'счёт' : cp.count < 5 ? 'счёта' : 'счетов'}</div>
                  </div>
                  <div className="dash-top-cp-sum">{fmtShort(cp.sum)} ₽</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status breakdown bar */}
      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-header">
          <h3>Распределение по статусам</h3>
          <Link to="/journal" className="btn btn-sm btn-secondary">Все счета</Link>
        </div>
        {allInvoices.length > 0 ? (
          <>
            <div className="dash-status-bar">
              {counts.paid > 0 && (
                <div className="dash-status-segment paid" style={{ flex: counts.paid }}
                  title={`Оплачено: ${counts.paid} (${fmt(paidSum)} ₽)`}>
                  <span>{counts.paid}</span>
                </div>
              )}
              {(counts.sent > 0 || counts.draft > 0) && (
                <div className="dash-status-segment sent" style={{ flex: counts.sent + counts.draft }}
                  title={`Ожидает: ${counts.sent + counts.draft}`}>
                  <span>{counts.sent + counts.draft}</span>
                </div>
              )}
              {counts.overdue > 0 && (
                <div className="dash-status-segment overdue" style={{ flex: counts.overdue }}
                  title={`Просрочено: ${counts.overdue}`}>
                  <span>{counts.overdue}</span>
                </div>
              )}
            </div>
            <div className="dash-status-legend">
              <div className="dash-status-legend-item"><span className="dot paid" /> Оплачено ({counts.paid})</div>
              <div className="dash-status-legend-item"><span className="dot sent" /> Ожидает ({counts.sent + counts.draft})</div>
              <div className="dash-status-legend-item"><span className="dot overdue" /> Просрочено ({counts.overdue})</div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <p style={{ fontFamily: 'Lora, serif', fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Нет данных
            </p>
            <p style={{ fontSize: '0.8125rem', marginBottom: 20 }}>Создайте первый счёт, чтобы увидеть статистику</p>
            <Link to="/invoice" className="btn btn-primary">Создать счёт</Link>
          </div>
        )}
      </div>

      {/* Recent invoices */}
      <div className="card">
        <div className="card-header">
          <h3>Последние счета</h3>
          <Link to="/journal" className="btn btn-sm btn-secondary">Все счета</Link>
        </div>
        {recentInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <p style={{ fontFamily: 'Lora, serif', fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Нет счетов
            </p>
            <p style={{ fontSize: '0.8125rem', marginBottom: 20 }}>Создайте первый счёт</p>
            <Link to="/invoice" className="btn btn-primary">Создать счёт</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Дата</th>
                  <th>Покупатель</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }}>
                    <td><strong>{inv.number}</strong></td>
                    <td>{inv.date?.split('-').reverse().join('.')}</td>
                    <td>{inv.counterpartyName || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt(inv.total)} ₽</td>
                    <td><span className={`status-badge ${inv.status}`}>{STATUS_LABELS[inv.status] || inv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
