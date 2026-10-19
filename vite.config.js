import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import scanCajetinHandler from './api/scan-cajetin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
  }
  if (env.VITE_GEMINI_API_KEY && !process.env.VITE_GEMINI_API_KEY) {
    process.env.VITE_GEMINI_API_KEY = env.VITE_GEMINI_API_KEY
  }

  return {
  plugins: [
    react(),
    {
      name: 'local-api-scan-cajetin',
      configureServer(server) {
        server.middlewares.use('/api/scan-cajetin', (req, res) => {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', async () => {
            try {
              req.body = body ? JSON.parse(body) : {}
            } catch (_) {
              req.body = {}
            }
            res.status = (code) => {
              res.statusCode = code
              return res
            }
            res.json = (obj) => {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(obj))
            }
            await scanCajetinHandler(req, res)
          })
        })
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'CDI EXHIBICIONES',
        short_name: 'CDI EXHIBICIONES',
        description: 'Aplicación de Control de Inventario y MRP',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 3000
  }
  }
})

