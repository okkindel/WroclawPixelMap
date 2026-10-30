// Element z index.html po id; brak elementu to błąd w szablonie strony.
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`brak elementu #${id}`)
  return el as T
}

// Wartość atrybutu (np. data-*) zawężona do dozwolonej listy; literówka w HTML daje undefined.
export const oneOf = <T extends string>(allowed: readonly T[], v: string | undefined): T | undefined => allowed.find((a) => a === v)
