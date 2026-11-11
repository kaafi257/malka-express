import { LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { InstallButton } from './InstallButton';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Header() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  return (
    <header className="topbar">
      <div className="brand">
        <div className="mark mini">M</div>
        <div>
          <b>{t('app.name')}</b>
          <small>{t('app.portal')}</small>
        </div>
      </div>
      <div className="user">
        <InstallButton />
        <LanguageSwitcher />
        {profile && (
          <span className="user-name">
            {profile.full_name}
            {profile.kind === 'staff' && <span className="role">{t(`role.${profile.role}`)}</span>}
          </span>
        )}
        <button className="icon-btn" onClick={() => void signOut()} aria-label={t('common.signOut')} title={t('common.signOut')}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
