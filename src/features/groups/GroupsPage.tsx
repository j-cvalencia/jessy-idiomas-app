import { useState, type DragEvent, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { DocumentInput } from '@/components/ui/DocumentInput'
import { TextInput } from '@/components/ui/TextInput'
import { isValidDocument, maskDocument, normalizeDocument } from '@/lib/document'
import {
  DAYS,
  LEVELS,
  assignStudent,
  assignTeacher,
  createGroup,
  createTeacher,
  resetTeacherPassword,
  deleteGroup,
  deleteTeacher,
  fullName,
  resetMockData,
  scheduleLabel,
  teacherShortName,
  updateGroupSchedule,
  useMockData,
  type Day,
  type Group,
  type Level,
  type Result,
  type Student,
  type Teacher,
} from '@/lib/mock-data'

// ---------------------------------------------------------------------
// Arrastrar y soltar
// ---------------------------------------------------------------------
const DRAG_TYPE = 'application/x-jessy'

interface Dragged {
  kind: 'student' | 'teacher'
  id: string
}

function startDrag(e: DragEvent, item: Dragged) {
  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item))
  e.dataTransfer.effectAllowed = 'move'
}

function readDrag(e: DragEvent): Dragged | null {
  try {
    const text = e.dataTransfer.getData(DRAG_TYPE)
    return text ? (JSON.parse(text) as Dragged) : null
  } catch {
    return null
  }
}

const isOurDrag = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE)

type Report = (result: Result, okText: string) => void

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/** Busca por nombre o por cualquier parte del número de documento. */
function matchesStudent(s: Student, query: string): boolean {
  const q = normalize(query.trim())
  if (!q) return true
  const digits = q.replace(/\D/g, '')
  return normalize(fullName(s)).includes(q) || (digits.length > 0 && s.docNumber.includes(digits))
}

/** "TI ••••••1234" */
const docLabel = (s: Student) => `${s.docType} ${maskDocument(s.docNumber)}`

const fieldClass =
  'min-h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

// ---------------------------------------------------------------------
// Días + hora de inicio + hora de salida (se usa al crear y al editar)
// ---------------------------------------------------------------------
interface ScheduleValue {
  days: Day[]
  time: string
  endTime: string
}

function ScheduleFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string
  value: ScheduleValue
  onChange: (next: ScheduleValue) => void
}) {
  const toggleDay = (day: Day) =>
    onChange({
      ...value,
      days: DAYS.filter((d) => (d === day ? !value.days.includes(d) : value.days.includes(d))),
    })

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset>
        <legend className="text-sm font-semibold">Días de clase</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={value.days.includes(day)}
              onClick={() => toggleDay(day)}
              className={`min-h-11 min-w-12 rounded-lg border px-3 text-sm font-bold transition ${
                value.days.includes(day)
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-white text-ink hover:bg-surface'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          id={`${idPrefix}-time`}
          label="Hora de inicio"
          type="time"
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
        />
        <TextInput
          id={`${idPrefix}-end`}
          label="Hora de salida"
          type="time"
          value={value.endTime}
          onChange={(e) => onChange({ ...value, endTime: e.target.value })}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Formulario: nuevo profesor
// ---------------------------------------------------------------------
function TeacherForm({
  onDone,
  onCancel,
}: {
  onDone: (name: string, username: string) => void
  onCancel: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [document, setDocument] = useState('')
  const [levels, setLevels] = useState<Level[]>([])
  const [error, setError] = useState<string | null>(null)

  const toggleLevel = (level: Level) =>
    setLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]))

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return setError('Escribe el nombre completo.')
    if (phone.replace(/\D/g, '').length < 7) return setError('Revisa el teléfono.')
    if (!isValidDocument(document)) return setError('Revisa el número de documento.')
    if (levels.length === 0) return setError('Elige al menos un nivel que pueda enseñar.')

    const result = createTeacher({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      docNumber: normalizeDocument(document),
      levels: LEVELS.filter((l) => levels.includes(l)),
    })
    if (!result.ok) return setError(result.error)
    onDone(`${firstName.trim()} ${lastName.trim()}`, result.username)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-xl font-extrabold">Nuevo profesor</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          id="t-first"
          label="Nombres"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <TextInput
          id="t-last"
          label="Apellidos"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <TextInput
          id="t-phone"
          label="Teléfono"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <DocumentInput id="t-doc" label="Documento" value={document} onChange={setDocument} />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Niveles que puede enseñar</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={levels.includes(level)}
              onClick={() => toggleLevel(level)}
              className={`min-h-11 min-w-14 rounded-lg border px-4 text-sm font-extrabold transition ${
                levels.includes(level)
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-ink hover:bg-surface'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Crear profesor</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Formulario: nuevo grupo (con profesor y alumnos opcionales desde el inicio)
// ---------------------------------------------------------------------
function GroupForm({
  teachers,
  unassigned,
  onDone,
  onCancel,
}: {
  teachers: Teacher[]
  unassigned: Student[]
  onDone: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState<Level>('A1')
  const [schedule, setSchedule] = useState<ScheduleValue>({ days: [], time: '', endTime: '' })
  const [teacherId, setTeacherId] = useState('')
  const [studentIds, setStudentIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const eligible = teachers.filter((t) => t.levels.includes(level))
  const visibleStudents = unassigned.filter((s) => matchesStudent(s, search))

  const toggleStudent = (id: string) =>
    setStudentIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))

  function changeLevel(next: Level) {
    setLevel(next)
    const current = teachers.find((t) => t.id === teacherId)
    if (current && !current.levels.includes(next)) setTeacherId('')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const result = createGroup({
      name,
      level,
      ...schedule,
      teacherId: teacherId || null,
      studentIds,
    })
    if (!result.ok) return setError(result.error)
    onDone(name.trim())
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-xl font-extrabold">Nuevo grupo</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          id="g-name"
          label="Nombre del grupo"
          placeholder="Ej. A1 Mañana"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="g-level" className="text-sm font-semibold">
            Nivel
          </label>
          <select
            id="g-level"
            value={level}
            onChange={(e) => changeLevel(e.target.value as Level)}
            className={`${fieldClass} min-h-12 text-base`}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ScheduleFields idPrefix="g" value={schedule} onChange={setSchedule} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="g-teacher" className="text-sm font-semibold">
            Profesor{' '}
            <span className="font-normal text-muted">(opcional, también puedes arrastrarlo después)</span>
          </label>
          <select
            id="g-teacher"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className={`${fieldClass} min-h-12 text-base`}
          >
            <option value="">Asignar después</option>
            {eligible.map((t) => (
              <option key={t.id} value={t.id}>
                {fullName(t)}
              </option>
            ))}
          </select>
          {eligible.length === 0 && (
            <span className="text-xs text-muted">Ningún profesor enseña el nivel {level} todavía.</span>
          )}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">
            Alumnos <span className="font-normal text-muted">({studentIds.length} elegidos)</span>
          </legend>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o documento"
            aria-label="Buscar alumno"
            className={`${fieldClass} mt-2 w-full`}
          />
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-line p-2">
            {unassigned.length === 0 ? (
              <p className="p-2 text-sm text-muted">No hay alumnos sin grupo.</p>
            ) : visibleStudents.length === 0 ? (
              <p className="p-2 text-sm text-muted">Ningún alumno coincide con la búsqueda.</p>
            ) : (
              visibleStudents.map((s) => (
                <label
                  key={s.id}
                  className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={studentIds.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    className="h-4 w-4 shrink-0 accent-brand"
                  />
                  <span>
                    {fullName(s)} <span className="tabular-nums text-xs text-muted">· {docLabel(s)}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </fieldset>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Crear grupo</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Tarjeta de grupo (misma apariencia de siempre + zona para soltar)
// ---------------------------------------------------------------------
function GroupCard({
  group,
  teachers,
  members,
  unassigned,
  report,
}: {
  group: Group
  teachers: Teacher[]
  members: Student[]
  unassigned: Student[]
  report: Report
}) {
  const [over, setOver] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ScheduleValue>({
    days: group.days,
    time: group.time,
    endTime: group.endTime,
  })
  const [editError, setEditError] = useState<string | null>(null)
  const teacher = teachers.find((t) => t.id === group.teacherId)
  const eligible = teachers.filter((t) => t.levels.includes(group.level))

  function startEditing() {
    setDraft({ days: group.days, time: group.time, endTime: group.endTime })
    setEditError(null)
    setEditing(true)
  }

  function saveSchedule() {
    const result = updateGroupSchedule(group.id, draft)
    if (!result.ok) return setEditError(result.error)
    setEditing(false)
    report(result, `Se actualizó el horario de ${group.name}.`)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    const item = readDrag(e)
    if (!item) return
    if (item.kind === 'teacher') {
      const t = teachers.find((x) => x.id === item.id)
      report(
        assignTeacher(group.id, item.id),
        `${t ? fullName(t) : 'El profesor'} ahora dicta ${group.name}.`,
      )
    } else {
      report(assignStudent(item.id, group.id), `Alumno agregado a ${group.name}.`)
    }
  }

  return (
    <article
      onDragOver={(e) => {
        if (!isOurDrag(e)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={handleDrop}
      className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 transition ${
        over ? 'border-brand ring-4 ring-brand/20' : 'border-line'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-ink px-3 py-1 text-xs font-extrabold text-white">{group.level}</span>
          <h2 className="font-display text-xl font-extrabold">{group.name}</h2>
        </div>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">
          {members.length} alumnos
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Profesor</dt>
          <dd className="mt-0.5 font-semibold">
            {teacher ? (
              <span
                draggable
                onDragStart={(e) => startDrag(e, { kind: 'teacher', id: teacher.id })}
                className="cursor-grab"
              >
                {fullName(teacher)}{' '}
                <button
                  type="button"
                  onClick={() =>
                    report(assignTeacher(group.id, null), `Se quitó al profesor de ${group.name}.`)
                  }
                  className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-accent"
                >
                  Quitar
                </button>
              </span>
            ) : (
              <span className="font-normal text-muted">Sin asignar · arrastra un profesor aquí</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Horario</dt>
          <dd className="mt-0.5 font-semibold">
            {scheduleLabel(group)}{' '}
            {!editing && (
              <button
                type="button"
                onClick={startEditing}
                className="text-xs font-semibold text-brand underline underline-offset-2"
              >
                Editar
              </button>
            )}
          </dd>
        </div>
      </dl>

      {editing && (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <ScheduleFields idPrefix={`edit-${group.id}`} value={draft} onChange={setDraft} />
          {editError && (
            <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
              {editError}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={saveSchedule}>
              Guardar horario
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Lista de alumnos</p>
        {members.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
            Arrastra alumnos aquí
          </p>
        ) : (
          <ol className="mt-2 grid list-decimal gap-x-6 gap-y-1 pl-5 text-sm sm:grid-cols-2">
            {members.map((s) => (
              <li key={s.id}>
                <span
                  draggable
                  onDragStart={(e) => startDrag(e, { kind: 'student', id: s.id })}
                  className="cursor-grab"
                >
                  {fullName(s)} <span className="tabular-nums text-xs text-muted">{docLabel(s)}</span>{' '}
                  <button
                    type="button"
                    aria-label={`Quitar a ${fullName(s)} de ${group.name}`}
                    onClick={() => report(assignStudent(s.id, null), `${fullName(s)} quedó sin grupo.`)}
                    className="text-xs font-bold text-muted hover:text-accent"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Alternativa para celular o teclado, donde arrastrar es incómodo */}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <select
          aria-label={`Profesor de ${group.name}`}
          value={group.teacherId ?? ''}
          onChange={(e) =>
            report(
              assignTeacher(group.id, e.target.value || null),
              e.target.value
                ? `Profesor asignado a ${group.name}.`
                : `Se quitó al profesor de ${group.name}.`,
            )
          }
          className={`${fieldClass} min-w-0 flex-1`}
        >
          <option value="">Sin profesor</option>
          {eligible.map((t) => (
            <option key={t.id} value={t.id}>
              {fullName(t)}
            </option>
          ))}
        </select>
        <select
          aria-label={`Agregar alumno a ${group.name}`}
          value=""
          onChange={(e) =>
            e.target.value &&
            report(assignStudent(e.target.value, group.id), `Alumno agregado a ${group.name}.`)
          }
          className={`${fieldClass} min-w-0 flex-1`}
        >
          <option value="">Agregar alumno…</option>
          {unassigned.map((s) => (
            <option key={s.id} value={s.id}>
              {fullName(s)} · {docLabel(s)}
            </option>
          ))}
        </select>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------
type Notice = { kind: 'ok' | 'error'; text: string } | null

export function GroupsPage() {
  const { teachers, groups, students } = useMockData()
  const [panel, setPanel] = useState<'group' | 'teacher' | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [poolOver, setPoolOver] = useState(false)
  const [poolSearch, setPoolSearch] = useState('')

  const unassigned = students.filter((s) => s.active && s.groupId === null)
  const visibleUnassigned = unassigned.filter((s) => matchesStudent(s, poolSearch))

  const report: Report = (result, okText) =>
    setNotice(result.ok ? { kind: 'ok', text: okText } : { kind: 'error', text: result.error })

  function handlePoolDrop(e: DragEvent) {
    e.preventDefault()
    setPoolOver(false)
    const item = readDrag(e)
    if (item?.kind === 'student') report(assignStudent(item.id, null), 'El alumno quedó sin grupo.')
  }

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black">Grupos y profesores</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {groups.length} grupos activos · {teachers.length} profesores · {unassigned.length} alumnos sin
            grupo
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setPanel(panel === 'teacher' ? null : 'teacher')}>
            Nuevo profesor
          </Button>
          <Button onClick={() => setPanel(panel === 'group' ? null : 'group')}>Nuevo grupo</Button>
        </div>
      </header>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-4 py-3 text-sm font-semibold ${
            notice.kind === 'error' ? 'bg-accent-soft text-accent' : 'bg-ok-soft text-ok'
          }`}
        >
          {notice.text}
        </p>
      )}

      {panel === 'teacher' && (
        <TeacherForm
          onCancel={() => setPanel(null)}
          onDone={(name, username) => {
            setPanel(null)
            setNotice({
              kind: 'ok',
              text: `Se creó al profesor ${name}. Usuario: ${username} · Clave inicial: su número de documento (la cambia al entrar por primera vez).`,
            })
          }}
        />
      )}
      {panel === 'group' && (
        <GroupForm
          teachers={teachers}
          unassigned={unassigned}
          onCancel={() => setPanel(null)}
          onDone={(name) => {
            setPanel(null)
            setNotice({ kind: 'ok', text: `Se creó el grupo ${name}.` })
          }}
        />
      )}

      {/* Por asignar: de aquí se arrastra hacia los grupos */}
      <div
        onDragOver={(e) => {
          if (!isOurDrag(e)) return
          e.preventDefault()
          setPoolOver(true)
        }}
        onDragLeave={() => setPoolOver(false)}
        onDrop={handlePoolDrop}
        className={`rounded-2xl border border-dashed bg-white p-5 transition ${
          poolOver ? 'border-brand ring-4 ring-brand/20' : 'border-line'
        }`}
      >
        <h2 className="font-display text-xl font-extrabold">Por asignar</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Arrastra un profesor o un alumno hasta la tarjeta de un grupo. En el celular usa los selectores de
          cada grupo.
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Profesores</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {teachers.length === 0 && (
                <span className="text-sm text-muted">Crea un profesor para empezar.</span>
              )}
              {teachers.map((t) => (
                <span
                  key={t.id}
                  draggable
                  onDragStart={(e) => startDrag(e, { kind: 'teacher', id: t.id })}
                  className="cursor-grab rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-dark"
                >
                  {fullName(t)} · {t.levels.join(', ')}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Alumnos sin grupo ({unassigned.length})
            </p>
            <input
              type="search"
              value={poolSearch}
              onChange={(e) => setPoolSearch(e.target.value)}
              placeholder="Buscar por nombre o documento"
              aria-label="Buscar alumno sin grupo"
              className={`${fieldClass} mt-2 w-full`}
            />
            <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {unassigned.length === 0 && (
                <span className="text-sm text-muted">Todos los alumnos tienen grupo.</span>
              )}
              {unassigned.length > 0 && visibleUnassigned.length === 0 && (
                <span className="text-sm text-muted">Ningún alumno coincide con la búsqueda.</span>
              )}
              {visibleUnassigned.map((s) => (
                <span
                  key={s.id}
                  draggable
                  onDragStart={(e) => startDrag(e, { kind: 'student', id: s.id })}
                  className="cursor-grab rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold"
                >
                  {fullName(s)} <span className="font-normal tabular-nums text-muted">· {docLabel(s)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center text-sm text-muted">
          Todavía no hay grupos. Crea el primero con «Nuevo grupo».
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-2">
              <GroupCard
                group={group}
                teachers={teachers}
                members={students.filter((s) => s.active && s.groupId === group.id)}
                unassigned={unassigned}
                report={report}
              />
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Eliminar el grupo ${group.name}? Sus alumnos quedarán sin grupo.`)) {
                    deleteGroup(group.id)
                    setNotice({ kind: 'ok', text: `Se eliminó el grupo ${group.name}.` })
                  }
                }}
                className="self-end text-xs font-semibold text-muted underline underline-offset-2 hover:text-accent"
              >
                Eliminar grupo
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="px-5 py-4 font-display text-xl font-extrabold">Profesores</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Profesor</th>
                <th className="px-3 py-3 font-semibold">Usuario</th>
                <th className="px-3 py-3 font-semibold">Documento</th>
                <th className="px-3 py-3 font-semibold">Teléfono</th>
                <th className="px-3 py-3 font-semibold">Niveles</th>
                <th className="px-3 py-3 font-semibold">Grupos a cargo</th>
                <th className="px-3 py-3 font-semibold">Alumnos</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => {
                const mine = groups.filter((g) => g.teacherId === t.id)
                const total = mine.reduce(
                  (sum, g) => sum + students.filter((s) => s.active && s.groupId === g.id).length,
                  0,
                )
                return (
                  <tr key={t.id} className="border-t border-line">
                    <td className="px-5 py-3.5 font-semibold">
                      {fullName(t)} <span className="font-normal text-muted">({teacherShortName(t)})</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="font-mono text-sm font-semibold">{t.username}</span>
                      {t.mustChangePassword && (
                        <span className="mt-0.5 block text-xs text-warn">Clave inicial: su documento</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 tabular-nums text-ink-soft">CC {maskDocument(t.docNumber)}</td>
                    <td className="px-3 py-3.5 text-ink-soft">{t.phone}</td>
                    <td className="px-3 py-3.5">{t.levels.join(' · ')}</td>
                    <td className="px-3 py-3.5">
                      {mine.length ? (
                        mine.map((g) => g.name).join(' · ')
                      ) : (
                        <span className="text-muted">Sin grupos</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 font-semibold tabular-nums">{total}</td>
                    <td className="space-x-3 whitespace-nowrap px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          resetTeacherPassword(t.id)
                          setNotice({
                            kind: 'ok',
                            text: `La clave de ${fullName(t)} volvió a ser su documento. Deberá cambiarla al entrar.`,
                          })
                        }}
                        className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-brand"
                      >
                        Restablecer clave
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(`¿Eliminar a ${fullName(t)}? Sus grupos quedarán sin profesor.`)
                          ) {
                            deleteTeacher(t.id)
                            setNotice({ kind: 'ok', text: `Se eliminó a ${fullName(t)}.` })
                          }
                        }}
                        className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-accent"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              })}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted">
                    Todavía no hay profesores. Crea el primero con «Nuevo profesor».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('¿Borrar todo lo creado y volver a los datos de ejemplo?')) {
              resetMockData()
              setNotice({ kind: 'ok', text: 'Se reiniciaron los datos de ejemplo.' })
            }
          }}
          className="font-semibold underline underline-offset-2 hover:text-accent"
        >
          Reiniciar datos de ejemplo
        </button>
      </div>
    </section>
  )
}
