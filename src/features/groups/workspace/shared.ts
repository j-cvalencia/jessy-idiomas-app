import { fullName, type Student, type Teacher } from '@/lib/mock-data'

export const fieldClass =
  'min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

/** Minúsculas y sin tildes, para buscar "munoz" y encontrar "Muñoz". */
export const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Busca por nombre o por los últimos dígitos del documento. */
export function matches(person: Student | Teacher, query: string): boolean {
  const q = normalize(query.trim())
  if (!q) return true
  const digits = q.replace(/\D/g, '')
  return normalize(fullName(person)).includes(q) || (digits.length > 0 && person.docNumber.endsWith(digits))
}

export type Notice = { kind: 'ok' | 'error'; text: string } | null
