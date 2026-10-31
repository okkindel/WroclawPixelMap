import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { type Plugin, defineConfig } from 'vite'

// wersja w oknie „O mapie”: numer z package.json, skrót commita i data budowania
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return ''
  }
})()

// Dev: adres /data/... to zawsze public/data/. Bez tego serwer podawał pliki o tych samych nazwach z katalogu roboczego
// data/ (surowe dane i kafle robocze, np. data/history/index.json), zamiast wypieczonych.
const publicData = (): Plugin => ({
  name: 'public-data-first',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url?.startsWith('/data/')) req.url = `/public${req.url}`
      next()
    })
  },
})

// względne ścieżki: mapa działa w dowolnym podkatalogu (np. okkindel.github.io/projects/wroclaw-w-pikselach/)
export default defineConfig({
  base: './',
  plugins: [publicData()],
  define: {
    __APP_VERSION__: JSON.stringify({ version, commit, date: new Date().toISOString().slice(0, 10) }),
  },
})
