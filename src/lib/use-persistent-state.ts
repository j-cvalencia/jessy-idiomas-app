import { useEffect, useState } from 'react'

/**
 * Como useState, pero recuerda el valor en el navegador (localStorage).
 * Sirve para que filtros y búsquedas sigan igual al volver a una pantalla.
 * Si el navegador no deja guardar (modo privado, etc.), funciona como useState normal.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const storageKey = `jessy:${key}`
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved === null ? initial : (JSON.parse(saved) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      /* sin almacenamiento: el filtro vive solo mientras la pantalla está abierta */
    }
  }, [storageKey, value])

  return [value, setValue] as const
}
