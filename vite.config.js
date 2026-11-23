import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// Browser previews have no Electron bridge, so the dev server exposes the same
// Roblox API module at /__orbit/<method>. The desktop app uses IPC instead.
const orbitDevApi = () => ({
  name: 'orbit-dev-api',
  configureServer(server) {
    const roblox = require('./electron/roblox.cjs')
    server.middlewares.use('/__orbit/', async (req, res) => {
      const method = req.url.replace(/^\//, '').split('?')[0]
      let body = ''
      for await (const c of req) body += c
      res.setHeader('content-type', 'application/json')
      try {
        if (!['sorts', 'search', 'gameDetails', 'lookupUser', 'searchUsers', 'presence', 'servers', 'userProfile', 'gameMedia', 'badges', 'catalog', 'placeUniverse', 'searchMany', 'genreGames', 'news', 'avatarImage'].includes(method)) throw new Error('Unknown method')
        const args = body ? JSON.parse(body) : []
        res.end(JSON.stringify({ ok: true, data: await roblox[method](...args) }))
      } catch (e) {
        res.end(JSON.stringify({ ok: false, error: e.message }))
      }
    })
  },
})

// Content Security Policy for the built app: scripts only from Moony itself,
// images from Roblox's CDNs (and the local screenshot protocol), no plugins,
// frames or remote code. Only added to builds: the dev server needs inline
// scripts for hot reload.
const CSP = [
  "default-src 'self' file:",
  "script-src 'self' file:",
  "style-src 'self' file: 'unsafe-inline'",
  "img-src 'self' file: data: blob: https: moony-shot:",
  "media-src 'self' file: data: blob: moony-shot:",
  "font-src 'self' file: data:",
  "connect-src 'self' file: data: blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
].join('; ')
const csp = () => ({
  name: 'moony-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
})

export default defineConfig({
  plugins: [react(), orbitDevApi(), csp()],
  base: './', // relative paths so the built app loads from file:// in Electron
  build: {
    // Two pages: the app, and the in-game HUD overlay.
    rollupOptions: { input: { main: 'index.html', overlay: 'overlay.html' } },
  },
})
