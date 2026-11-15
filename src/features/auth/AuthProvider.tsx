import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { loginToEmail } from '@/lib/username'
import type { Profile } from '@/lib/types'
import { AuthContext, type AuthState } from './auth-context'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, doc_type, doc_number, first_name, last_name, role, is_activated, active, username, must_change_password',
    )
    .eq('id', userId)
    .single()
  if (error) {
    console.error('No se pudo cargar el perfil', error)
    return null
  }
  return data as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load(next: Session | null) {
      setSession(next)
      setProfile(next ? await fetchProfile(next.user.id) : null)
      if (!cancelled) setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      // Diferimos la consulta para no bloquear el callback de Supabase.
      setTimeout(() => load(next), 0)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (login: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginToEmail(login),
      password,
    })
    if (error) throw new Error('Usuario o contraseña incorrectos')
  }, [])

  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!session || !profile) throw new Error('Inicia sesión de nuevo.')
      if (newPassword.length < 8) throw new Error('La clave debe tener al menos 8 caracteres.')
      if (newPassword === profile.doc_number)
        throw new Error('La clave nueva no puede ser tu número de documento.')
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw new Error('No se pudo cambiar la clave. Intenta de nuevo.')
      // Quita la marca con una función de la base (el usuario no puede editar su perfil directamente).
      const { error: rpcError } = await supabase.rpc('mark_password_changed')
      if (rpcError) throw new Error('La clave cambió, pero no se pudo guardar. Avísale a la academia.')
      setProfile(await fetchProfile(session.user.id))
    },
    [session, profile],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthState>(
    () => ({ session, profile, loading, signIn, signOut, changePassword }),
    [session, profile, loading, signIn, signOut, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
