import './styles/main.css'
import { startApp } from './app.ts'
import { applyI18n, t } from './i18n/index.ts'
import { registerPWA } from './pwa.ts'

applyI18n()
registerPWA()
startApp().catch((err) => {
  console.error(err)
  document.getElementById('loading')!.textContent = t('loadError')
})
