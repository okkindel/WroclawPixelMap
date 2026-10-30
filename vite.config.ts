import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// wersja w oknie „O mapie”: numer z package.json, skrót commita i data budowania
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return ''
  }
})()

// względne ścieżki: mapa działa w dowolnym podkatalogu (np. okkindel.github.io/projects/wroclaw-w-pikselach/)
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify({ version, commit, date: new Date().toISOString().slice(0, 10) }),
  },
})
