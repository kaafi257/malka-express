import { useI18n } from '../lib/i18n';

export function ConfigMissing() {
  const { t } = useI18n();
  return (
    <main className="center">
      <section className="card">
        <div className="mark">M</div>
        <h1>{t('config.title')}</h1>
        <p>{t('config.body')}</p>
        <code>VITE_SUPABASE_URL</code>
        <code>VITE_SUPABASE_ANON_KEY</code>
        <p className="muted">{t('config.note')}</p>
      </section>
    </main>
  );
}
