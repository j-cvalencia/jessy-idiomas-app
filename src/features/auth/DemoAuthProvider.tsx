import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile, Role } from '@/lib/types'
import { changeTeacherPassword, checkTeacherLogin, useMockData, type Teacher } from '@/lib/mock-data'
import { AuthContext, type AuthState } from './auth-context'

// Proveedor falso para ver las pantallas sin Supabase. Solo se usa en `npm run dev`.
// El director y el estudiante entran con los botones de demo. Los profesores que crea
// el director en "Grupos y profesores" entran con su usuario y su clave, como será en la real.

const STORAGE_KEY = 'jessy-demo-session'

interface DemoSession {
  role: Role
  /** Profesor creado por el director (si entró como profesor). */
  teacherId?: string
}

const DEMO_PROFILES: Record<Role, Profile> = {
  master: demoProfile('master', 'Jessy', 'Directora', '1036003768'),
  teacher: demoProfile('teacher', 'Laura', 'Gómez', '1020304050'),
  student: demoProfile('student', 'Sara', 'Restrepo', '1001234567'),
}

function demoProfile(role: Role, first_name: string, last_name: string, doc_number: string): Profile {
  return {
    id: `demo-${role}`,
    doc_type: 'CC',
    doc_number,
    first_name,
    last_name,
    role,
    is_activated: true,
    active: true,
  }
}

function teacherProfile(t: Teacher): Profile {
  return {
    id: t.id,
    doc_type: 'CC',
    doc_number: t.docNumber,
    first_name: t.firstName,
    last_name: t.lastName,
    role: 'teacher',
    is_activated: true,
    active: true,
    username: t.username,
    must_change_password: t.mustChangePassword,
  }
}

function readStored(): DemoSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
    return value && value.role in DEMO_PROFILES ? (value as DemoSession) : null
  } catch {
    return null
  }
}

function store(value: DemoSession | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sin almacenamiento: la demo igual funciona hasta recargar */
  }
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState<DemoSession | null>(readStored)
  const { teachers } = useMockData()

  const start = useCallback((next: DemoSession) => {
    store(next)
    setDemo(next)
  }, [])

  const signInAsDemo = useCallback((role: Role, teacherId?: string) => start({ role, teacherId }), [start])

  const signIn = useCallback(
    async (login: string, password: string) => {
      const teacher = checkTeacherLogin(login, password)
      if (teacher) return start({ role: 'teacher', teacherId: teacher.id })
      throw new Error(
        'Usuario o contraseña incorrectos. En el modo demo solo los profesores entran con usuario; el director y el estudiante usan los botones.',
      )
    },
    [start],
  )

  const signOut = useCallback(async () => {
    store(null)
    setDemo(null)
  }, [])

  const teacher = demo?.teacherId ? teachers.find((t) => t.id === demo.teacherId) : undefined

  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!teacher) throw new Error('En el modo demo solo los profesores creados pueden cambiar su clave.')
      const result = changeTeacherPassword(teacher.id, newPassword)
      if (!result.ok) throw new Error(result.error)
    },
    [teacher],
  )

  const value = useMemo<AuthState>(() => {
    // Si el profesor fue eliminado mientras tenía la sesión abierta, la sesión se cierra.
    const profile = !demo
      ? null
      : demo.teacherId
        ? teacher
          ? teacherProfile(teacher)
          : null
        : DEMO_PROFILES[demo.role]
    const session = profile ? ({ user: { id: profile.id } } as unknown as Session) : null
    return { session, profile, loading: false, signIn, signOut, changePassword, signInAsDemo }
  }, [demo, teacher, signIn, signOut, changePassword, signInAsDemo])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
