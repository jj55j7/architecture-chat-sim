import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The simulation service runs separately (default http://127.0.0.1:8000).
// We proxy /sim/* to it so the browser makes same-origin requests and we
// never depend on the third-party service having CORS enabled.
// Override the target with SIM_API_TARGET if the service runs elsewhere.
const target = process.env.SIM_API_TARGET ?? 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/sim': {
        target,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sim/, ''),
      },
    },
  },
  test: {
    environment: 'node',
  },
});
