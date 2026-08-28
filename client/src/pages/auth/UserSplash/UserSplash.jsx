import { useEffect, useState } from 'react';
import './UserSplash.css';

export default function UserSplash({ children }) {
  const [visible, setVisible] = useState(() => !window.sessionStorage.getItem('aasha-user-splash-seen'));
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    
    window.sessionStorage.setItem('aasha-user-splash-seen', 'true');
    
    // Total animation is ~2s (fade out starts at 2s)
    const fadeTimer = window.setTimeout(() => setLeaving(true), 2000);
    // Destroy component at 2.4s to give fade out time to finish
    const finishTimer = window.setTimeout(() => setVisible(false), 2400);
    
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
    };
  }, [visible]);

  if (!visible) return children;

  return (
    <main className={`user-splash-premium ${leaving ? 'user-splash-premium--leaving' : ''}`} aria-label="Welcome to Aasha SM Tech">
      <section className="splash-premium-content">
        <div className="splash-premium-text-wrapper">
          <p className="splash-premium-eyebrow">Welcome to</p>
          <h1 className="splash-premium-title">AASHA SM TECH</h1>
        </div>
      </section>
    </main>
  );
}
