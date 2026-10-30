// Pliki danych z public/data (względem BASE_URL, więc mapa działa w dowolnym podkatalogu).
export const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`

// JSON z public/data/<file> jako T albo null, gdy pliku nie ma (HTTP ≠ 200) lub nie da się go wczytać.
// Typ T to umowa z plikiem wypiekanym przez scripts/bake (nie jest sprawdzany w czasie działania).
export async function loadJson<T>(file: string): Promise<T | null> {
  try {
    const r = await fetch(dataUrl(file))
    if (!r.ok) return null
    const json: T = await r.json()
    return json
  } catch {
    return null
  }
}
