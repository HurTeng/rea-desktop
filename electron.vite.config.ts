import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: { build: { rollupOptions: { external: ['original-fs'] } } },
  preload: {},
  renderer: {
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'development-csp',
        apply: 'serve',
        transformIndexHtml: (html) =>
          html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
      }
    ]
  }
})
