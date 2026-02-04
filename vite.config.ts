import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Isso garante que os links funcionem no GitHub Pages (caminho relativo)
  build: {
    outDir: 'dist',
  }
})