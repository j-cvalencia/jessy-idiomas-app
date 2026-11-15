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
import { baseUsername, uniqueUsername } from '@/lib/username'

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
  /** Usuario para entrar: primer nombre + 2 letras de cada apellido (ej. "laurasmgo"). */
  username: string
  /**
   * SOLO PARA EL MODO DEMO. En la base real la clave la guarda Supabase Auth cifrada
   * y nunca pasa por aquí. Empieza siendo el documento del profesor.
   */
  password: string
  /** Debe cambiar la clave al entrar (la inicial es su documento). */
  mustChangePassword: boolean
}

export type NewTeacher = Omit<Teacher, 'id' | 'username' | 'password' | 'mustChangePassword'>

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
  /** Último día cubierto por sus pagos (AAAA-MM-DD), o null si nunca ha pagado. */
  paidUntil: string | null
  /** Porcentaje de asistencia de ejemplo, 0–100. Si hay asistencia tomada, se usa esa. */
  attendance: number
  practicedLastWeek: boolean
}

export type PaymentMethod = 'efectivo' | 'transferencia' | 'nequi' | 'otro'

export interface Payment {
  id: string
  studentId: string
  /** Cuántos meses cubre este pago. */
  months: number
  /** Desde qué día cubre (AAAA-MM-DD). */
  from: string
  /** Hasta qué día cubre (AAAA-MM-DD). */
  until: string
  amount: number
  method: PaymentMethod
  /** Día en que se registró (AAAA-MM-DD). */
  paidAt: string
  notes: string
}

/** Asistencia de un estudiante en la clase de un grupo en una fecha. */
export interface AttendanceRecord {
  groupId: string
  date: string
  studentId: string
  present: boolean
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
  payments: Payment[]
  attendance: AttendanceRecord[]
}

export type Result = { ok: true } | { ok: false; error: string }
const fail = (error: string): Result => ({ ok: false, error })
const ok: Result = { ok: true }

type RawStudent = Omit<Student, 'paidUntil'> & {
  paidUntil?: string | null
  paymentStatus?: 'al_dia' | 'pendiente'
}
const data = raw as unknown as {
  teachers: Teacher[]
  groups: Group[]
  students: RawStudent[]
  lessons: Lesson[]
}

export const lessons: Lesson[] = data.lessons

// ---------------------------------------------------------------------
// Almacén en memoria (con copia en localStorage)
// ---------------------------------------------------------------------
const STORAGE_KEY = 'jessy-mock-v2'

// ---------------------------------------------------------------------
// Fechas (siempre en hora local, como texto AAAA-MM-DD)
// ---------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const todayISO = () => toISO(new Date())
export function addDays(iso: string, days: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}
/** Suma meses respetando fin de mes: 31 ene + 1 mes = 28/29 feb. */
export function addMonths(iso: string, months: number): string {
  const d = fromISO(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISO(d)
}
export const daysBetween = (a: string, b: string) =>
  Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000)
/** "2026-12-15" → "15 dic 2026" */
export function dateLabel(iso: string): string {
  return fromISO(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Datos de ejemplo: "al día" cubre hasta dentro de 20 días; "pendiente" se venció hace 3.
function exampleStudent(s: RawStudent): Student {
  const { paymentStatus, ...rest } = s
  const paidUntil =
    s.paidUntil !== undefined
      ? s.paidUntil
      : paymentStatus === 'pendiente'
        ? addDays(todayISO(), -3)
        : addDays(todayISO(), 20)
  return { ...rest, paidUntil }
}

/** Completa profesores guardados antes de existir el usuario y la clave. */
function withCredentials(teachers: Teacher[]): Teacher[] {
  const taken: string[] = []
  return teachers.map((t) => {
    const username = t.username || uniqueUsername(baseUsername(t.firstName, t.lastName), taken)
    taken.push(username)
    return {
      ...t,
      username,
      password: t.password ?? t.docNumber,
      mustChangePassword: t.mustChangePassword ?? true,
    }
  })
}

function initialState(): MockState {
  return {
    teachers: withCredentials(data.teachers),
    groups: data.groups,
    students: data.students.map(exampleStudent),
    payments: [],
    attendance: [],
  }
}

function load(): MockState {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    if (text) {
      const saved = JSON.parse(text)
      if (Array.isArray(saved?.teachers) && Array.isArray(saved?.groups) && Array.isArray(saved?.students)) {
        const loaded = saved as MockState
        return {
          // Grupos guardados antes de existir la hora de salida.
          groups: loaded.groups.map((g) => ({ ...g, endTime: g.endTime ?? '' })),
          // Datos guardados antes de existir usuarios, pagos y asistencia.
          teachers: withCredentials(loaded.teachers),
          students: (loaded.students as RawStudent[]).map(exampleStudent),
          payments: Array.isArray(loaded.payments) ? loaded.payments : [],
          attendance: Array.isArray(loaded.attendance) ? loaded.attendance : [],
        }
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
export const teacherShortName = (t?: Teacher) =>
  t ? `${t.firstName} ${t.lastName.charAt(0)}.` : 'Sin asignar'

export const studentsOfGroup = (groupId: string) =>
  state.students.filter((s) => s.active && s.groupId === groupId)

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
  const days =
    d.length <= 1
      ? (d[0] ?? '')
      : d.length === 2
        ? `${d[0]} y ${d[1]}`
        : `${d.slice(0, -1).join(', ')} y ${d[d.length - 1]}`
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
  if (toMinutes(sch.endTime) <= toMinutes(sch.time))
    return 'La hora de salida debe ser después de la de inicio.'
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
export type CreateTeacherResult = { ok: true; username: string } | { ok: false; error: string }

/** Crea el profesor con su usuario. La clave inicial es su documento y debe cambiarla al entrar. */
export function createTeacher(input: NewTeacher): CreateTeacherResult {
  if (state.teachers.some((t) => t.docNumber === input.docNumber)) {
    return { ok: false, error: 'Ya existe un profesor con ese documento.' }
  }
  const username = uniqueUsername(
    baseUsername(input.firstName, input.lastName),
    state.teachers.map((t) => t.username),
  )
  const teacher: Teacher = {
    ...input,
    id: `t-${Date.now().toString(36)}`,
    username,
    password: input.docNumber,
    mustChangePassword: true,
  }
  update((s) => ({ ...s, teachers: [...s.teachers, teacher] }))
  return { ok: true, username }
}

/** Vuelve a poner como clave el documento y obliga a cambiarla (cuando el profesor la olvida). */
export function resetTeacherPassword(id: string) {
  update((s) => ({
    ...s,
    teachers: s.teachers.map((t) =>
      t.id === id ? { ...t, password: t.docNumber, mustChangePassword: true } : t,
    ),
  }))
}

/** SOLO MODO DEMO: revisa usuario (o documento) y clave de un profesor. */
export function checkTeacherLogin(login: string, password: string): Teacher | null {
  const value = login.trim().toLowerCase()
  const t = state.teachers.find((x) => x.username === value || x.docNumber === value.replace(/\D/g, ''))
  return t && t.password === password ? t : null
}

export function changeTeacherPassword(id: string, password: string): Result {
  const t = state.teachers.find((x) => x.id === id)
  if (!t) return fail('El profesor no existe.')
  if (password.length < 8) return fail('La clave debe tener al menos 8 caracteres.')
  if (password === t.docNumber) return fail('La clave nueva no puede ser tu número de documento.')
  update((s) => ({
    ...s,
    teachers: s.teachers.map((x) => (x.id === id ? { ...x, password, mustChangePassword: false } : x)),
  }))
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
    students: s.students.map((st) =>
      input.studentIds.includes(st.id) && st.active ? { ...st, groupId: id } : st,
    ),
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
    groups: s.groups.map((g) =>
      g.id === groupId ? { ...g, days: schedule.days, time: schedule.time, endTime: schedule.endTime } : g,
    ),
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
      return g.plannedLessonNumber === suggested
        ? g
        : { ...g, plannedLessonNumber: suggested, status: 'draft' }
    }),
  }))
}

/** Publica todos los borradores y devuelve cuántos eran. */
export function publishAll(): number {
  const drafts = state.groups.filter((g) => g.status === 'draft').length
  update((s) => ({ ...s, groups: s.groups.map((g) => ({ ...g, status: 'published' as const })) }))
  return drafts
}

// ---------------------------------------------------------------------
// Pagos (registro manual del director)
// ---------------------------------------------------------------------
/** Días antes del vencimiento en que el estudiante pasa a "próximo a vencer". */
export const DUE_SOON_DAYS = 7

export type PaymentState = 'al_dia' | 'por_vencer' | 'vencido' | 'sin_pago'

export function paymentState(s: Pick<Student, 'paidUntil'>, today = todayISO()): PaymentState {
  if (!s.paidUntil) return 'sin_pago'
  const left = daysBetween(today, s.paidUntil)
  if (left < 0) return 'vencido'
  if (left <= DUE_SOON_DAYS) return 'por_vencer'
  return 'al_dia'
}

/** Días que le quedan (negativo si ya se venció). Null si nunca ha pagado. */
export function daysLeft(s: Pick<Student, 'paidUntil'>, today = todayISO()): number | null {
  return s.paidUntil ? daysBetween(today, s.paidUntil) : null
}

/** El siguiente pago empieza al día siguiente de lo ya cubierto, o hoy si está vencido. */
export function nextPaymentStart(s: Pick<Student, 'paidUntil'>, today = todayISO()): string {
  return s.paidUntil && s.paidUntil >= today ? addDays(s.paidUntil, 1) : today
}

/** Último día que cubre un pago de `months` meses que empieza en `from`. */
export const coverageUntil = (from: string, months: number) => addDays(addMonths(from, months), -1)

export interface NewPayment {
  studentId: string
  months: number
  from: string
  amount: number
  method: PaymentMethod
  notes?: string
}

export function registerPayment(input: NewPayment): Result {
  const student = state.students.find((s) => s.id === input.studentId)
  if (!student) return fail('El estudiante no existe.')
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 24)
    return fail('Elige entre 1 y 24 meses.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from)) return fail('Elige desde qué fecha cubre el pago.')
  if (!(input.amount > 0)) return fail('Escribe el valor pagado.')

  const until = coverageUntil(input.from, input.months)
  const payment: Payment = {
    id: `p-${Date.now().toString(36)}`,
    studentId: input.studentId,
    months: input.months,
    from: input.from,
    until,
    amount: input.amount,
    method: input.method,
    paidAt: todayISO(),
    notes: input.notes?.trim() ?? '',
  }
  update((s) => ({
    ...s,
    payments: [payment, ...s.payments],
    students: s.students.map((st) =>
      st.id === input.studentId && (!st.paidUntil || until > st.paidUntil) ? { ...st, paidUntil: until } : st,
    ),
  }))
  return ok
}

/** Borra un pago registrado por error y recalcula hasta cuándo queda cubierto el estudiante. */
export function deletePayment(id: string) {
  const payment = state.payments.find((p) => p.id === id)
  if (!payment) return
  update((s) => {
    const payments = s.payments.filter((p) => p.id !== id)
    const remaining = payments.filter((p) => p.studentId === payment.studentId).map((p) => p.until)
    const latest = remaining.length ? remaining.sort().at(-1)! : null
    return {
      ...s,
      payments,
      students: s.students.map((st) => (st.id === payment.studentId ? { ...st, paidUntil: latest } : st)),
    }
  })
}

export const paymentsOf = (studentId: string) => state.payments.filter((p) => p.studentId === studentId)

// ---------------------------------------------------------------------
// Profesor: sus grupos y la asistencia
// ---------------------------------------------------------------------
const JS_DAY_TO_DAY: Day[] = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** "2026-11-16" → "Lun" */
export const dayOfDate = (iso: string): Day => JS_DAY_TO_DAY[fromISO(iso).getDay()]

/** "2026-11-16" → "lunes 16 de noviembre" */
export function longDateLabel(iso: string): string {
  return fromISO(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

export const groupsOfTeacher = (teacherId: string) => state.groups.filter((g) => g.teacherId === teacherId)

/** La clase publicada por el director para el grupo, o null si aún no la publica. */
export function publishedLesson(group: Group): Lesson | null {
  if (group.status !== 'published') return null
  return lessonsOfLevel(group.level).find((l) => l.number === group.plannedLessonNumber) ?? null
}

/** Asistencia ya tomada para un grupo en una fecha: { idEstudiante: presente }. */
export function attendanceOn(groupId: string, date: string): Record<string, boolean> {
  return Object.fromEntries(
    state.attendance
      .filter((a) => a.groupId === groupId && a.date === date)
      .map((a) => [a.studentId, a.present]),
  )
}

export function saveAttendance(groupId: string, date: string, marks: Record<string, boolean>): Result {
  if (!state.groups.some((g) => g.id === groupId)) return fail('El grupo no existe.')
  if (date > todayISO()) return fail('No se puede tomar asistencia de una clase que aún no ha pasado.')
  const records: AttendanceRecord[] = Object.entries(marks).map(([studentId, present]) => ({
    groupId,
    date,
    studentId,
    present,
  }))
  update((s) => ({
    ...s,
    attendance: [...s.attendance.filter((a) => !(a.groupId === groupId && a.date === date)), ...records],
  }))
  return ok
}

/** % de asistencia del estudiante: con la asistencia tomada si existe, si no el dato de ejemplo. */
export function studentAttendance(s: Student): number {
  const mine = state.attendance.filter((a) => a.studentId === s.id)
  if (mine.length === 0) return s.attendance
  return Math.round((100 * mine.filter((a) => a.present).length) / mine.length)
}
