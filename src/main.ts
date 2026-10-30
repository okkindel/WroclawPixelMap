import './styles/main.css'
import { startApp } from './app.ts'

startApp().catch((err) => {
  console.error(err)
  document.getElementById('loading')!.textContent = 'Nie udało się wczytać mapy :('
})
