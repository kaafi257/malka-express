import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { fetchStaff, updateStaff } from '../lib/api';
import { formatPhone } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { StaffMember, StaffProfile, StaffRole } from '../lib/types';

const ROLES: StaffRole[] = ['owner', 'manager', 'employee'];

export function TeamPage({ me }: { me: StaffProfile }) {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStaff(await fetchStaff());
    } catch (e) {
      notify('error', tError(e));
    } finally {
      setLoading(false);
    }
  }, [notify, tError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(m: StaffMember, patch: { active?: boolean; role?: StaffRole }) {
    if (patch.active === false && !window.confirm(t('team.confirmDeactivate'))) return;
    setBusyId(m.id);
    try {
      await updateStaff(m.id, patch);
      notify('success', t('team.updated'));
      await load();
    } catch (e) {
      notify('error', tError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="intro">
        <div>
          <p className="eyebrow">{t('staff.eyebrow')}</p>
          <h1>{t('team.title')}</h1>
          <p className="muted">{t('team.subtitle')}</p>
        </div>
        <button className="secondary" onClick={() => void load()}>
          <RefreshCw size={15} /> {t('common.refresh')}
        </button>
      </div>
      {loading ? (
        <p className="muted center-text">{t('common.loading')}</p>
      ) : (
        <section className="panel">
          <div className="list">
            {staff.map((m) => {
              const self = m.id === me.id;
              return (
                <article key={m.id} className={`order member ${m.active ? '' : 'cancelled'}`}>
                  <div className="order-head">
                    <div>
                      <b>
                        {m.full_name} {self && <span className="role">{t('team.you')}</span>}
                      </b>
                      <small>{formatPhone(m.phone)}</small>
                    </div>
                    <span className={`status ${m.active ? 'ready' : 'cancelled'}`}>
                      {m.active ? t('team.active') : t('team.inactive')}
                    </span>
                  </div>
                  {!self && (
                    <div className="inline-form wrap">
                      <select
                        value={m.role}
                        disabled={busyId === m.id}
                        aria-label={t('team.title')}
                        onChange={(e) => void change(m, { role: e.target.value as StaffRole })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {t(`role.${r}`)}
                          </option>
                        ))}
                      </select>
                      <button
                        className={m.active ? 'secondary' : 'primary'}
                        disabled={busyId === m.id}
                        onClick={() => void change(m, { active: !m.active })}
                      >
                        {m.active ? t('team.deactivate') : t('team.activate')}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <p className="hint">{t('team.addHint')}</p>
        </section>
      )}
    </>
  );
}
