import { useEffect, useState } from 'react';
import { api } from '../api/client';

function fmtKopeks(k: number) { return new Intl.NumberFormat('ru-RU').format(k / 100); }

export function BillingPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [plansRes, subRes] = await Promise.all([api.getPlans(), api.getSubscription()]);
      setPlans(plansRes.plans);
      setSub(subRes.subscription);
      setUsage(subRes.usage);
    } catch {}
  }

  function showToast(msg: string, type = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  }

  async function handleSubscribe(planId: string) {
    try {
      const res = await api.subscribe(planId) as any;
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
      } else {
        showToast('Подписка оформлена');
        loadData();
      }
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  async function handleCancel() {
    if (!confirm('Отменить подписку?')) return;
    try {
      await api.cancelSubscription();
      showToast('Подписка будет отменена в конце периода');
      loadData();
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  const usagePct = usage?.limit ? Math.min(100, Math.round((usage.invoicesThisMonth / usage.limit) * 100)) : 0;

  return (
    <>
      <div className="page-hero">
        <h1>Подписка <em>и тарифы.</em></h1>
        <div className="page-hero-sub">Выберите подходящий тариф для работы со счетами</div>
      </div>

      {sub && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><h3>Текущая подписка</h3></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'Lora, serif' }}>{sub.planName || 'Бесплатный'}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                Статус: <span className={`status-badge ${sub.status}`}>{sub.status === 'active' ? 'Активна' : sub.status}</span>
                {sub.currentPeriodEnd && <span style={{ marginLeft: 12 }}>До: {new Date(sub.currentPeriodEnd).toLocaleDateString('ru-RU')}</span>}
              </div>
            </div>
            {sub.planCode !== 'free' && (
              <button className="btn btn-sm btn-secondary" onClick={handleCancel}>Отменить подписку</button>
            )}
          </div>

          {usage && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>Счетов в этом месяце</span>
                <span><strong style={{ color: 'var(--accent-ink)' }}>{usage.invoicesThisMonth}</strong>{usage.limit ? ` из ${usage.limit}` : ' (без лимита)'}</span>
              </div>
              {usage.limit && (
                <div style={{ width: '100%', height: 6, background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${usagePct}%`, height: '100%', background: usagePct > 80 ? 'var(--danger)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {plans.map((plan) => {
          const isActive = sub?.planCode === plan.code;
          return (
            <div key={plan.id} className="card" style={{ borderColor: isActive ? 'var(--accent)' : undefined }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 20, fontFamily: 'Lora, serif', fontWeight: 600 }}>{plan.name}</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, fontFamily: 'IBM Plex Mono, monospace' }}>
                  {plan.priceKopeks === 0 ? 'Бесплатно' : `${fmtKopeks(plan.priceKopeks)} ₽/мес`}
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 20 }}>
                <div>✓ {plan.monthlyInvoiceLimit || 'Безлимит'} счетов в месяц</div>
                <div>✓ До {plan.maxOrganizations} организации</div>
                {plan.features?.exportHistory && <div>✓ Экспорт журнала в Excel</div>}
                {plan.features?.prioritySupport && <div>✓ Приоритетная поддержка</div>}
              </div>
              {isActive ? (
                <button className="btn btn-secondary" style={{ width: '100%' }} disabled>Текущий тариф</button>
              ) : (
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleSubscribe(plan.id)}>
                  {plan.priceKopeks === 0 ? 'Выбрать' : 'Подключить'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {toast && <div className="toast-container"><div className={`toast ${toast.type}`} onClick={() => setToast(null)}>{toast.msg}</div></div>}
    </>
  );
}
