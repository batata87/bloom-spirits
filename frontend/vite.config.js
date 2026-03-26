import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

const { version } = pkg

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  server: {
    // Matches common local URL; if 5174 is busy Vite picks the next free port.
    port: 5174,
    strictPort: false,
  },
})
