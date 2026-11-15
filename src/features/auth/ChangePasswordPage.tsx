import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { HOME_BY_ROLE } from '@/lib/types'
import { useAuth } from './auth-context'

/** Cambio de clave. Es obligatorio la primera vez que entra un profesor (su clave inicial es su documento). */
export function ChangePasswordPage() {
  const { session, profile, changePassword, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!session || !profile) return <Navigate to="/login" replace />
  const required = Boolean(profile.must_change_password)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) return setError('Las dos claves no coinciden.')
    setSaving(true)
    try {
      await changePassword(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la clave.')
    } finally {
      setSaving(false)
    }
  }

  // Cuando ya no hay que cambiarla (por ejemplo, recién la cambió), sigue a su panel.
  if (!required) return <Navigate to={HOME_BY_ROLE[profile.role]} replace />

  return (
    <main className="flex min-h-screen flex-col items-center bg-surface px-5 py-12">
      <img src="/logo.webp" alt="" className="h-20 w-20" />
      <form
        onSubmit={submit}
        className="mt-6 flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h1 className="font-display text-2xl font-extrabold">Crea tu clave</h1>
        <p className="text-sm text-ink-soft">
          Hola, {profile.first_name}. Tu clave inicial es tu número de documento; por seguridad, cámbiala por
          una que solo tú conozcas.
        </p>
        {profile.username && (
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">
            Tu usuario para entrar es <span className="font-mono font-bold">{profile.username}</span>
          </p>
        )}
        <TextInput
          id="new-password"
          label="Clave nueva (mínimo 8 caracteres)"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <TextInput
          id="confirm-password"
          label="Repite la clave nueva"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
            {error}
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar y entrar'}
        </Button>
        <button type="button" onClick={signOut} className="text-sm font-semibold text-muted hover:underline">
          Salir
        </button>
      </form>
    </main>
  )
}
