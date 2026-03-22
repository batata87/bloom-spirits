import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Matches common local URL; if 5174 is busy Vite picks the next free port.
    port: 5174,
    strictPort: false,
  },
})
