import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile, Role } from '@/lib/types'

export interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  /** `login` es el usuario (profesores) o el número de documento. */
  signIn: (login: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Cambia la clave del usuario actual y quita la obligación de cambiarla. */
  changePassword: (newPassword: string) => Promise<void>
  /** Solo existe en modo demo. Para el profesor se puede indicar cuál. */
  signInAsDemo?: (role: Role, teacherId?: string) => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
