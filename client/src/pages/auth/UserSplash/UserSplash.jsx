import { useEffect, useState } from 'react';
import './UserSplash.css';

export default function UserSplash({ children }) {
  const [visible, setVisible] = useState(() => !window.sessionStorage.getItem('aasha-user-splash-seen'));
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    window.sessionStorage.setItem('aasha-user-splash-seen', 'true');
    const fadeTimer = window.setTimeout(() => setLeaving(true), 2650);
    const finishTimer = window.setTimeout(() => setVisible(false), 3000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
    };
  }, [visible]);

  if (!visible) return children;

  return (
    <main className={`user-splash ${leaving ? 'user-splash--leaving' : ''}`} aria-label="Aasha SM Tech CRM System">
      <div className="user-splash__glow user-splash__glow--one" />
      <div className="user-splash__glow user-splash__glow--two" />
      <section className="user-splash__content">
        <div className="user-splash__logo-wrap">
          <img src="/aasha-sm-logo.jpeg" alt="Aasha SM Tech" className="user-splash__logo" />
        </div>
        <p className="user-splash__eyebrow">Welcome to</p>
        <h1>Aasha SM Tech</h1>
        <p className="user-splash__title">CRM System</p>
        <div className="user-splash__loader" aria-hidden="true"><span /></div>
      </section>
    </main>
  );
}
