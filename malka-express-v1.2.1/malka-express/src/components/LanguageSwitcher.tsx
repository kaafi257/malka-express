import { Languages } from 'lucide-react';
import { LANGUAGES, useI18n, type Language } from '../lib/i18n';

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="lang" title={t('common.language')}>
      <Languages size={16} aria-hidden />
      <select aria-label={t('common.language')} value={lang} onChange={(e) => setLang(e.target.value as Language)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
