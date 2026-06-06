import aitDevtools from '@ait-co/devtools/unplugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), aitDevtools.vite({ panel: true })],
  // Keep the SDK and its bridge/analytics entry points out of Vite's dep
  // pre-bundle. Otherwise Vite ships the real @apps-in-toss/web-* as
  // pre-bundled modules and the devtools unplugin (which only runs on
  // source resolves) never gets a chance to rewrite them to the mock.
  optimizeDeps: {
    exclude: [
      '@apps-in-toss/web-framework',
      '@apps-in-toss/web-bridge',
      '@apps-in-toss/web-analytics',
    ],
  },
});
