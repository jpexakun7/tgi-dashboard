import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sanitize VITE_SUPABASE_URL if passed with markdown link syntax like [url](url)
if (process.env.VITE_SUPABASE_URL) {
  const urlMatch = process.env.VITE_SUPABASE_URL.match(/https?:\/\/[^\s)\]"']+/);
  if (urlMatch) {
    process.env.VITE_SUPABASE_URL = urlMatch[0].replace(/\/+$/, '');
  }
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

