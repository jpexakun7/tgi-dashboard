import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          if (reg.active?.scriptURL.includes('dev-sw.js')) {
            reg.unregister().catch(() => {});
          }
        }
      })
      .catch(() => {});

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Silently ignore if service worker registration is restricted in iframe preview
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);


