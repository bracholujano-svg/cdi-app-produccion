import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import scanCajetinHandler from './api/scan-cajetin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const buildId = String(Date.now())
  const env = loadEnv(mode, process.cwd(), '')
  if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
  }
  if (env.VITE_GEMINI_API_KEY && !process.env.VITE_GEMINI_API_KEY) {
    process.env.VITE_GEMINI_API_KEY = env.VITE_GEMINI_API_KEY
  }

  return {
  define: {
    __CDI_BUILD_ID__: JSON.stringify(buildId)
  },
  plugins: [
    react(),
    {
      name: 'cdi-version-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ version: buildId, buildId })
        })
      }
    },
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
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: null,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/version\.json(\?.*)?$/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      },
      manifest: {
        name: 'CDI EXHIBICIONES',
        short_name: 'CDI EXHIBICIONES',
        description: 'Aplicación de Control de Inventario y MRP',
        theme_color: '#1E293B',
        background_color: '#0B1120',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/cdi-logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/cdi-logo.png',
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

