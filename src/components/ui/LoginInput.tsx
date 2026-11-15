import { useState } from 'react'
import { maskDocument } from '@/lib/document'

interface Props {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
}

/**
 * Campo de ingreso que acepta usuario (profesores) o número de documento.
 * Si lo escrito es un documento, al salir del campo muestra solo los últimos 4 dígitos.
 */
export function LoginInput({ id, label, value, onChange, hint }: Props) {
  const [focused, setFocused] = useState(false)
  const isDocument = /^[\d.\s-]+$/.test(value)
  const shown = focused || !isDocument ? value : maskDocument(value)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={shown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 rounded-lg border border-line bg-white px-3.5 text-base tracking-wide outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  )
}
