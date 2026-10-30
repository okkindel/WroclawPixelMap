// Rejestracja service workera (tylko w buildzie produkcyjnym; w dev przeszkadzałby HMR).
export function registerPWA() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  addEventListener('load', () => {
    // względna ścieżka: zakres SW = katalog aplikacji (np. /wroclaw/)
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => console.warn('SW:', err))
  })
}
