// Usuarios de los profesores: primer nombre + 2 primeras letras de cada apellido.
// "Laura Andrea" "Smith Gómez" → "laurasmgo". Si ya existe, se le agrega un número: "laurasmgo2".
//
// Supabase Auth trabaja con correo, así que el usuario se convierte en un correo
// interno que la persona nunca ve (igual que el documento, ver document.ts).
import { INTERNAL_EMAIL_DOMAIN, isValidDocument, documentToEmail } from './document'

/** Minúsculas, sin tildes ni ñ, solo letras. */
function lettersOnly(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
}

/** Usuario base a partir de nombres y apellidos. Usa máximo dos apellidos. */
export function baseUsername(firstNames: string, lastNames: string): string {
  const first = lettersOnly(firstNames).split(/\s+/)[0] ?? ''
  const surnames = lettersOnly(lastNames).split(/\s+/).filter(Boolean).slice(0, 2)
  return first + surnames.map((s) => s.slice(0, 2)).join('')
}

/** Agrega un número si el usuario ya está tomado: laurasmgo, laurasmgo2, laurasmgo3… */
export function uniqueUsername(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}${n}`)) n++
  return `${base}${n}`
}

/** ¿Lo que escribió la persona es un usuario (letras) y no un documento (solo números)? */
export function isUsername(value: string): boolean {
  return /^[a-z]+\d*$/.test(value.trim().toLowerCase())
}

/** Usuario → correo interno de Supabase Auth. */
export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase()
  if (!isUsername(u)) throw new Error('Usuario inválido')
  return `${u}@${INTERNAL_EMAIL_DOMAIN}`
}

/** Lo que se escribe en el login (usuario o documento) → correo interno. */
export function loginToEmail(value: string): string {
  if (isUsername(value)) return usernameToEmail(value)
  if (isValidDocument(value)) return documentToEmail(value)
  throw new Error('Escribe tu usuario o tu número de documento.')
}
