import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

/** "Install app" button: Android/Chrome shows the install prompt; iPhone shows how to add it. */
export function InstallButton() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (standalone || (!evt && !ios)) return null;

  return (
    <button
      type="button"
      className="icon-btn"
      style={{ width: 'auto', padding: '0 10px', gap: 6, display: 'inline-flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700 }}
      onClick={() => (evt ? void evt.prompt() : window.alert('To install: tap the Share button, then "Add to Home Screen".'))}
    >
      <Download size={16} aria-hidden /> Install app
    </button>
  );
}
