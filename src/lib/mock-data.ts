// Datos simulados mientras no existe la base de datos en Supabase.
//
// Los estudiantes y las lecciones vienen de src/data/mock.json. Los grupos y los
// profesores NO existen de entrada: el director los crea desde la pantalla
// "Grupos y profesores". Todo se guarda en el navegador (localStorage) para que
// no se pierda al navegar o recargar.
//
// Cuando conecten Supabase, cada función de este archivo se reemplaza por una
// consulta o una mutación y las pantallas casi no cambian.
import { useSyncExternalStore } from 'react'
import raw from '@/data/mock.json'

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
export type Day = 'Lun' | 'Mar' | 'Mié' | 'Jue' | 'Vie' | 'Sáb' | 'Dom'
export type PlanStatus = 'draft' | 'published'

export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1']
export const DAYS: Day[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export interface Teacher {
  id: string
  firstName: string
  lastName: string
  phone: string
  docNumber: string
  /** Niveles que puede enseñar (uno o varios). */
  levels: Level[]
}

export interface Group {
  id: string
  name: string
  level: Level
  teacherId: string | null
  days: Day[]
  /** Hora de inicio en formato 24 h, ej. "08:00". */
  time: string
  /** Hora de salida en formato 24 h, ej. "09:30". Puede venir vacía en grupos creados antes de este campo. */
  endTime: string
  /** Última clase que ya dictó el grupo. La sugerida es la siguiente. */
  lastLessonNumber: number
  plannedLessonNumber: number
  status: PlanStatus
}

export interface Student {
  id: string
  firstName: string
  lastName: string
  docType: 'CC' | 'TI'
  docNumber: string
  phone: string
  groupId: string | null
  active: boolean
  paymentStatus: 'al_dia' | 'pendiente'
  /** Porcentaje de asistencia, 0–100. */
  attendance: number
  practicedLastWeek: boolean
}

export interface Lesson {
  level: Level
  number: number
  topic: string
  isExam: boolean
}

export interface MockState {
  teachers: Teacher[]
  groups: Group[]
  students: Student[]
}

export type Result = { ok: true } | { ok: false; error: string }
const fail = (error: string): Result => ({ ok: false, error })
const ok: Result = { ok: true }

const data = raw as unknown as MockState & { lessons: Lesson[] }

export const lessons: Lesson[] = data.lessons

// ---------------------------------------------------------------------
// Almacén en memoria (con copia en localStorage)
// ---------------------------------------------------------------------
const STORAGE_KEY = 'jessy-mock-v2'

function initialState(): MockState {
  return { teachers: data.teachers, groups: data.groups, students: data.students }
}

function load(): MockState {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    if (text) {
      const saved = JSON.parse(text)
      if (Array.isArray(saved?.teachers) && Array.isArray(saved?.groups) && Array.isArray(saved?.students)) {
        const loaded = saved as MockState
        // Grupos guardados antes de existir la hora de salida.
        return { ...loaded, groups: loaded.groups.map((g) => ({ ...g, endTime: g.endTime ?? '' })) }
      }
    }
  } catch {
    /* sin almacenamiento o dato dañado: se usan los datos iniciales */
  }
  return initialState()
}

let state: MockState = load()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function update(change: (s: MockState) => MockState) {
  state = change(state)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* nada */
  }
  listeners.forEach((l) => l())
}

/** Hook: devuelve los datos y vuelve a pintar la pantalla cuando cambian. */
export function useMockData(): MockState {
  return useSyncExternalStore(subscribe, () => state)
}

/** Borra todo lo que creó el director y vuelve a los datos de ejemplo. */
export function resetMockData() {
  update(() => initialState())
}

// ---------------------------------------------------------------------
// Utilidades de lectura
// ---------------------------------------------------------------------
export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`

export const teacherById = (id: string | null) => (id ? state.teachers.find((t) => t.id === id) : undefined)
export const groupById = (id: string | null) => (id ? state.groups.find((g) => g.id === id) : undefined)

/** "Laura Gómez" → "Laura G." */
export const teacherShortName = (t?: Teacher) => (t ? `${t.firstName} ${t.lastName.charAt(0)}.` : 'Sin asignar')

export const studentsOfGroup = (groupId: string) => state.students.filter((s) => s.active && s.groupId === groupId)

export const lessonsOfLevel = (level: Level) => lessons.filter((l) => l.level === level)

export const lessonLabel = (l: Lesson) => (l.isExam ? 'Examen' : `Clase ${l.number}`)

/** La clase que sigue según el orden del currículo. */
export function suggestedLessonNumber(group: Group): number {
  const max = lessonsOfLevel(group.level).length
  return Math.min(group.lastLessonNumber + 1, max)
}

/** "08:00" → "8:00 am" */
export function timeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}

/** ["Lun","Mié"] + "08:00" → "Lun y Mié · 8:00 am" */
export function scheduleLabel(group: Pick<Group, 'days' | 'time' | 'endTime'>): string {
  const d = group.days
  const days = d.length <= 1 ? (d[0] ?? '') : d.length === 2 ? `${d[0]} y ${d[1]}` : `${d.slice(0, -1).join(', ')} y ${d[d.length - 1]}`
  const end = group.endTime ? ` – ${timeLabel(group.endTime)}` : ''
  return `${days} · ${timeLabel(group.time)}${end}`
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

type Schedule = Pick<Group, 'days' | 'time' | 'endTime'>

/** Motivo por el que un horario no es válido, o null si está bien. */
function scheduleError(sch: Schedule): string | null {
  if (sch.days.length === 0) return 'Elige al menos un día de clase.'
  if (!sch.time) return 'Elige la hora de inicio.'
  if (!sch.endTime) return 'Elige la hora de salida.'
  if (toMinutes(sch.endTime) <= toMinutes(sch.time)) return 'La hora de salida debe ser después de la de inicio.'
  return null
}

/** ¿Dos horarios coinciden en algún día y se cruzan en las horas? */
function overlaps(a: Schedule, b: Schedule): boolean {
  if (!a.days.some((d) => b.days.includes(d))) return false
  const a0 = toMinutes(a.time)
  const b0 = toMinutes(b.time)
  // Grupos antiguos sin hora de salida: se asume 1 hora de clase.
  const a1 = a.endTime ? toMinutes(a.endTime) : a0 + 60
  const b1 = b.endTime ? toMinutes(b.endTime) : b0 + 60
  return a0 < b1 && b0 < a1
}

// ---------------------------------------------------------------------
// Reglas de asignación del profesor
// ---------------------------------------------------------------------
/** Devuelve el motivo por el que el profesor NO puede tomar ese grupo, o null si puede. */
function teacherProblem(
  teacherId: string,
  group: { id: string | null; level: Level; days: Day[]; time: string; endTime: string },
): string | null {
  const t = state.teachers.find((x) => x.id === teacherId)
  if (!t) return 'El profesor no existe.'
  if (!t.levels.includes(group.level)) return `${fullName(t)} no enseña el nivel ${group.level}.`
  const clash = state.groups.find((g) => g.id !== group.id && g.teacherId === teacherId && overlaps(g, group))
  if (clash) return `${fullName(t)} ya tiene ${clash.name} en ese horario (${scheduleLabel(clash)}).`
  return null
}

// ---------------------------------------------------------------------
// Profesores
// ---------------------------------------------------------------------
export function createTeacher(input: Omit<Teacher, 'id'>): Result {
  if (state.teachers.some((t) => t.docNumber === input.docNumber)) {
    return fail('Ya existe un profesor con ese documento.')
  }
  const teacher: Teacher = { ...input, id: `t-${Date.now().toString(36)}` }
  update((s) => ({ ...s, teachers: [...s.teachers, teacher] }))
  return ok
}

export function deleteTeacher(id: string) {
  update((s) => ({
    ...s,
    teachers: s.teachers.filter((t) => t.id !== id),
    groups: s.groups.map((g) => (g.teacherId === id ? { ...g, teacherId: null } : g)),
  }))
}

// ---------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------
export interface NewGroup {
  name: string
  level: Level
  days: Day[]
  time: string
  endTime: string
  teacherId: string | null
  studentIds: string[]
}

export function createGroup(input: NewGroup): Result {
  const name = input.name.trim()
  if (!name) return fail('Escribe el nombre del grupo.')
  const badSchedule = scheduleError(input)
  if (badSchedule) return fail(badSchedule)
  if (input.teacherId) {
    const problem = teacherProblem(input.teacherId, {
      id: null,
      level: input.level,
      days: input.days,
      time: input.time,
      endTime: input.endTime,
    })
    if (problem) return fail(problem)
  }

  const id = `g-${Date.now().toString(36)}`
  const group: Group = {
    id,
    name,
    level: input.level,
    teacherId: input.teacherId,
    days: input.days,
    time: input.time,
    endTime: input.endTime,
    lastLessonNumber: 0,
    plannedLessonNumber: 1,
    status: 'draft',
  }
  update((s) => ({
    ...s,
    groups: [...s.groups, group],
    students: s.students.map((st) => (input.studentIds.includes(st.id) && st.active ? { ...st, groupId: id } : st)),
  }))
  return ok
}

/** Cambia los días y las horas de un grupo que ya existe. */
export function updateGroupSchedule(groupId: string, schedule: Schedule): Result {
  const group = state.groups.find((g) => g.id === groupId)
  if (!group) return fail('El grupo no existe.')
  const badSchedule = scheduleError(schedule)
  if (badSchedule) return fail(badSchedule)
  if (group.teacherId) {
    const problem = teacherProblem(group.teacherId, { ...group, ...schedule })
    if (problem) return fail(problem)
  }
  update((s) => ({
    ...s,
    groups: s.groups.map((g) => (g.id === groupId ? { ...g, days: schedule.days, time: schedule.time, endTime: schedule.endTime } : g)),
  }))
  return ok
}

export function deleteGroup(id: string) {
  update((s) => ({
    ...s,
    groups: s.groups.filter((g) => g.id !== id),
    students: s.students.map((st) => (st.groupId === id ? { ...st, groupId: null } : st)),
  }))
}

/** Asigna (o quita, con null) el profesor de un grupo. */
export function assignTeacher(groupId: string, teacherId: string | null): Result {
  const group = state.groups.find((g) => g.id === groupId)
  if (!group) return fail('El grupo no existe.')
  if (teacherId) {
    const problem = teacherProblem(teacherId, group)
    if (problem) return fail(problem)
  }
  update((s) => ({ ...s, groups: s.groups.map((g) => (g.id === groupId ? { ...g, teacherId } : g)) }))
  return ok
}

/** Mueve un estudiante a un grupo (o lo deja sin grupo, con null). */
export function assignStudent(studentId: string, groupId: string | null): Result {
  const student = state.students.find((s) => s.id === studentId)
  if (!student) return fail('El estudiante no existe.')
  if (!student.active) return fail('Un estudiante inactivo no se puede asignar a un grupo.')
  update((s) => ({ ...s, students: s.students.map((st) => (st.id === studentId ? { ...st, groupId } : st)) }))
  return ok
}

// ---------------------------------------------------------------------
// Planificación semanal
// ---------------------------------------------------------------------
export function setGroupPlan(groupId: string, lesson: number, status: PlanStatus) {
  update((s) => ({
    ...s,
    groups: s.groups.map((g) => (g.id === groupId ? { ...g, plannedLessonNumber: lesson, status } : g)),
  }))
}

export function acceptSuggestions() {
  update((s) => ({
    ...s,
    groups: s.groups.map((g) => {
      const suggested = suggestedLessonNumber(g)
      return g.plannedLessonNumber === suggested ? g : { ...g, plannedLessonNumber: suggested, status: 'draft' }
    }),
  }))
}

/** Publica todos los borradores y devuelve cuántos eran. */
export function publishAll(): number {
  const drafts = state.groups.filter((g) => g.status === 'draft').length
  update((s) => ({ ...s, groups: s.groups.map((g) => ({ ...g, status: 'published' as const })) }))
  return drafts
}
