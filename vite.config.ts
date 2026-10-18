import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base './' : i percorsi sono relativi, quindi l'app funziona sia alla radice di un dominio
// (Cloudflare, Netlify) sia in una sottocartella (GitHub Pages: utente.github.io/nome-repo/).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
