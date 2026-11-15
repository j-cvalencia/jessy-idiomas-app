// Copia de src/lib/document.ts para las Edge Functions (Deno no lee src/).
// Si cambias una, cambia la otra.
export const INTERNAL_EMAIL_DOMAIN = 'usuarios.jessyidiomas.app'

export function normalizeDocument(value: string): string {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidDocument(value: string): boolean {
  const d = normalizeDocument(value)
  return d.length >= 6 && d.length <= 12
}

export function documentToEmail(value: string): string {
  return `${normalizeDocument(value)}@${INTERNAL_EMAIL_DOMAIN}`
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return n.toString().padStart(6, '0')
}

// Copia de src/lib/username.ts (usuario de los profesores). Si cambias una, cambia la otra.
function lettersOnly(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
}

export function baseUsername(firstNames: string, lastNames: string): string {
  const first = lettersOnly(firstNames).split(/\s+/)[0] ?? ''
  const surnames = lettersOnly(lastNames).split(/\s+/).filter(Boolean).slice(0, 2)
  return first + surnames.map((s) => s.slice(0, 2)).join('')
}

export function uniqueUsername(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}${n}`)) n++
  return `${base}${n}`
}

export function usernameToEmail(username: string): string {
  return `${username}@${INTERNAL_EMAIL_DOMAIN}`
}
