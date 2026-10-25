import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Il numero di versione dell'app (lo stesso dell'etichetta del rilascio) arriva in `__APP_VERSION__`: vedi utils/appVersion.js.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    tailwindcss(),
    mkcert({ hosts: ['localhost', '127.0.0.1', '*.smarteats.local'] }),
    VitePWA({
      // `prompt`: il service worker scarica la versione nuova ma non ricarica la pagina da solo; decide hooks/useAppUpdate.js.
      registerType: 'prompt',
      // Icone in public/: il simbolo occupa il 56% del lato, quindi la 512 vale anche
      // come icona "maskable" (resta dentro la zona sicura quando il sistema la ritaglia).
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'SmartEats',
        short_name: 'SmartEats',
        description: 'Gestionale per sagre, eventi e ristorazione',
        lang: 'it',
        theme_color: '#2563eb',
        background_color: '#0a0b0d',
        display: 'standalone',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Nessuna cache delle risposte API: potrebbe servire dati di un altro utente.
      // Offline il catalogo e l'ultima sessione arrivano da Dexie/localStorage (src/offline/).
    }),
  ],
  server: {
    https: true,
    host: true,
    port: 5173,
    strictPort: true,
    // Il punto iniziale ammette tutti i sottodomini: ogni tenant ha il suo.
    allowedHosts: ['.smarteats.local'],
  },
})
