import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Handled by vite-plugin-pwa or silently ignored if unsupported in environment
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);

