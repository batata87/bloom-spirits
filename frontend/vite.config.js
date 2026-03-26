import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }
import { execSync } from 'node:child_process'

const { version } = pkg
let gitSha = process.env.VERCEL_GIT_COMMIT_SHA || ''
if (!gitSha) {
  try {
    gitSha = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    gitSha = 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
    // Map Vercel system variables to Vite-compatible env keys.
    'import.meta.env.VITE_VERCEL_ID': JSON.stringify(process.env.VERCEL_DEPLOYMENT_ID || 'local'),
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha || 'dev'),
  },
  server: {
    // Matches common local URL; if 5174 is busy Vite picks the next free port.
    port: 5174,
    strictPort: false,
  },
})
