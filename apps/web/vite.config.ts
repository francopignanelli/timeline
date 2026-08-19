import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Amplify is the single heaviest dependency and it changes far less
        // often than app code, so give it its own long-lived cache entry.
        // Route-level splitting handles the app side (see app/router.tsx).
        manualChunks: {
          amplify: ['aws-amplify', 'aws-amplify/auth'],
        },
      },
    },
  },
});
