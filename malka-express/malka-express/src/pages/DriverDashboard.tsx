import { RefreshCw } from 'lucide-react';
import { NewRequestForm } from '../components/NewRequestForm';
import { OrderList } from '../components/OrderList';
import { StatCards } from '../components/StatCards';
import { useOrders } from '../hooks/useOrders';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { useEffect } from 'react';

export function DriverDashboard() {
  const { t, tError } = useI18n();
  const { userId } = useAuth();
  const { notify } = useToast();
  const { orders, loading, error, reload } = useOrders();

  useEffect(() => {
    if (error) notify('error', tError(error));
  }, [error, notify, tError]);

  if (!userId) return null;
  return (
    <>
      <div className="intro">
        <div>
          <h1>{t('driver.title')}</h1>
          <p className="muted">{t('driver.subtitle')}</p>
        </div>
        <button className="secondary" onClick={() => void reload()}>
          <RefreshCw size={15} /> {t('common.refresh')}
        </button>
      </div>
      <StatCards orders={orders} detailed={false} />
      <NewRequestForm userId={userId} onCreated={reload} />
      {loading ? (
        <p className="muted center-text">{t('common.loading')}</p>
      ) : (
        <OrderList title={t('driver.title')} orders={orders} viewer="driver" onChanged={reload} />
      )}
    </>
  );
}
