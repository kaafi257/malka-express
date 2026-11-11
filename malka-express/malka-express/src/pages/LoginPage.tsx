import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { registerDriver, signInDriver, signInStaff } from '../lib/api';
import { AppError } from '../lib/errors';
import { normalizePhone } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';

type Tab = 'staff' | 'driver';
type DriverMode = 'signin' | 'register';

export function LoginPage() {
  const { t, tError } = useI18n();
  const { problem } = useAuth();
  const [tab, setTab] = useState<Tab>('driver');
  const [driverMode, setDriverMode] = useState<DriverMode>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (tab === 'staff') {
        await signInStaff(email, password);
      } else {
        const normalized = normalizePhone(phone);
        if (!normalized) throw new AppError('phone_invalid');
        if (driverMode === 'register') {
          if (fullName.trim().length < 2) throw new AppError('name_required');
          await registerDriver(fullName, normalized);
        } else {
          await signInDriver(normalized);
        }
      }
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  }

  const problemText = problem === 'inactive' ? t('login.inactive') : problem === 'no_profile' ? t('login.noProfile') : '';

  return (
    <main className="auth">
      <div className="auth-band">
        <div className="auth-band-inner">
          <div className="login-top">
            <div className="mark">M</div>
            <LanguageSwitcher />
          </div>
          <p className="stencil">{t('app.port')}</p>
          <h1>{t('app.name')}</h1>
          <p className="muted">{t('app.tagline')}</p>
        </div>
      </div>
      <section className="card login">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'driver'} className={tab === 'driver' ? 'selected' : ''} onClick={() => setTab('driver')}>
            {t('login.driverTab')}
          </button>
          <button role="tab" aria-selected={tab === 'staff'} className={tab === 'staff' ? 'selected' : ''} onClick={() => setTab('staff')}>
            {t('login.staffTab')}
          </button>
        </div>

        {tab === 'driver' && (
          <div className="tabs sub" role="tablist">
            <button className={driverMode === 'signin' ? 'selected' : ''} onClick={() => setDriverMode('signin')}>
              {t('login.driverSignIn')}
            </button>
            <button className={driverMode === 'register' ? 'selected' : ''} onClick={() => setDriverMode('register')}>
              {t('login.driverRegister')}
            </button>
          </div>
        )}

        <form onSubmit={(e) => void submit(e)}>
          {tab === 'staff' ? (
            <>
              <label>
                {t('login.email')}
                <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                {t('login.password')}
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              <p className="hint">{t('login.staffHint')}</p>
            </>
          ) : (
            <>
              {driverMode === 'register' && (
                <label>
                  {t('login.fullName')}
                  <input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </label>
              )}
              <label>
                {t('login.phone')}
                <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('login.phoneHint')} required />
              </label>
            </>
          )}

          <button className="primary" disabled={busy}>
            {tab === 'driver' && driverMode === 'register'
              ? busy ? t('login.creating') : t('login.createAccount')
              : busy ? t('login.signingIn') : t('login.signIn')}{' '}
            <ArrowRight size={16} />
          </button>
        </form>

        {(error || problemText) && <p className="notice error">{error || problemText}</p>}
        <p className="foot">
          <ShieldCheck size={14} /> {t('app.secured')}
        </p>
      </section>
    </main>
  );
}
