import { CreditCard, FileText, Home, User } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

export type DriverView = 'home' | 'requests' | 'payments' | 'profile';

const ITEMS = [
  { id: 'home', icon: Home },
  { id: 'requests', icon: FileText },
  { id: 'payments', icon: CreditCard },
  { id: 'profile', icon: User },
] as const;

export function BottomNav({ view, onChange, badge }: { view: DriverView; onChange: (v: DriverView) => void; badge: number }) {
  const { t } = useI18n();
  return (
    <nav className="bottom-nav" aria-label="Main">
      {ITEMS.map(({ id, icon: Icon }) => (
        <button key={id} className={view === id ? 'on' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => onChange(id)}>
          <span className="ico">
            <Icon size={22} aria-hidden />
            {id === 'payments' && badge > 0 && <i className="dot-badge">{badge}</i>}
          </span>
          <span>{t(`nav.${id}`)}</span>
        </button>
      ))}
    </nav>
  );
}
