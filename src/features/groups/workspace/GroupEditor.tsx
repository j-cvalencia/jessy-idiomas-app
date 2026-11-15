import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { maskDocument } from '@/lib/document'
import {
  DAYS,
  LEVELS,
  fullName,
  groupById,
  publishGroup,
  roomProblem,
  saveGroup,
  teacherAvailability,
  useMockData,
  type Day,
  type Group,
  type GroupDraft,
  type Level,
} from '@/lib/mock-data'
import { fieldClass, matches } from './shared'

interface Props {
  /** Grupo a editar, o null para crear uno nuevo. */
  group: Group | null
  onClose: () => void
  onSaved: (text: string) => void
}

const emptyDraft: GroupDraft = {
  name: '',
  level: 'A1',
  days: [],
  time: '',
  endTime: '',
  roomId: null,
  teacherId: null,
  studentIds: [],
}

/**
 * Panel para crear o editar un grupo. Todo (datos, horario, salón, profesor y alumnos)
 * se cambia aquí y se guarda junto con un solo botón. Cancelar descarta todo.
 */
export function GroupEditor({ group, onClose, onSaved }: Props) {
  const { teachers, students, rooms } = useMockData()
  const [draft, setDraft] = useState<GroupDraft>(() =>
    group
      ? {
          name: group.name,
          level: group.level,
          days: group.days,
          time: group.time,
          endTime: group.endTime,
          roomId: group.roomId,
          teacherId: group.teacherId,
          studentIds: students.filter((s) => s.active && s.groupId === group.id).map((s) => s.id),
        }
      : emptyDraft,
  )
  const [teacherSearch, setTeacherSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof GroupDraft>(key: K, value: GroupDraft[K]) => {
    setError(null)
    setDraft((d) => ({ ...d, [key]: value }))
  }

  // Escape cierra el panel sin guardar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const groupId = group?.id ?? null
  const hasSchedule = draft.days.length > 0 && draft.time && draft.endTime
  const roomWarning = draft.roomId && hasSchedule ? roomProblem(draft.roomId, groupId, draft) : null
  const room = rooms.find((r) => r.id === draft.roomId)
  const overCapacity = room?.capacity ? draft.studentIds.length > room.capacity : false

  const selected = draft.studentIds
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))

  // Primero los que no tienen grupo; si la búsqueda lo encuentra, también los de otros grupos (se moverían).
  const candidates = useMemo(() => {
    const pool = students.filter((s) => s.active && !draft.studentIds.includes(s.id))
    if (!studentSearch.trim()) return pool.filter((s) => s.groupId === null).slice(0, 8)
    return pool
      .filter((s) => matches(s, studentSearch))
      .sort((a, b) => Number(a.groupId !== null) - Number(b.groupId !== null))
      .slice(0, 8)
  }, [students, draft.studentIds, studentSearch])

  const teacherList = teachers.filter((t) => matches(t, teacherSearch))

  function save(publish: boolean) {
    const result = saveGroup(groupId, draft)
    if (!result.ok) return setError(result.error)
    if (publish) {
      const published = publishGroup(result.id)
      if (!published.ok) return setError(published.error)
    }
    onSaved(
      publish
        ? `Se guardó y publicó ${draft.name.trim()}. El profesor ya lo ve.`
        : `Se guardó ${draft.name.trim()}.${group?.published ? '' : ' Queda como borrador hasta que lo publiques.'}`,
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-editor-title"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-6 py-4">
          <h2 id="group-editor-title" className="font-display text-2xl font-extrabold">
            {group ? `Editar ${group.name}` : 'Nuevo grupo'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar sin guardar"
            className="grid h-11 w-11 place-items-center rounded-full text-2xl text-muted hover:bg-surface"
          >
            ×
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* 1. Datos */}
          <Section n={1} title="Nombre y nivel">
            <input
              aria-label="Nombre del grupo"
              placeholder="Ej. A1 Lunes y miércoles noche"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              className={fieldClass}
            />
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <Chip key={level} active={draft.level === level} onClick={() => set('level', level as Level)}>
                  {level}
                </Chip>
              ))}
            </div>
          </Section>

          {/* 2. Horario y salón */}
          <Section n={2} title="Horario y salón">
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <Chip
                  key={day}
                  active={draft.days.includes(day)}
                  onClick={() =>
                    set(
                      'days',
                      DAYS.filter((d: Day) => (d === day ? !draft.days.includes(d) : draft.days.includes(d))),
                    )
                  }
                >
                  {day}
                </Chip>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Hora de inicio
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => set('time', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Hora de salida
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Salón
                <select
                  value={draft.roomId ?? ''}
                  onChange={(e) => set('roomId', e.target.value || null)}
                  className={fieldClass}
                >
                  <option value="">Sin salón</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.capacity ? ` (cupo ${r.capacity})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {rooms.length === 0 && (
              <p className="text-xs text-muted">
                Crea los salones en la pestaña «Salones» para poder elegirlos.
              </p>
            )}
            {roomWarning && <Warning>{roomWarning}</Warning>}
          </Section>

          {/* 3. Profesor */}
          <Section n={3} title="Profesor">
            {teachers.length > 5 && (
              <input
                type="search"
                placeholder="Buscar profesor"
                aria-label="Buscar profesor"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                className={fieldClass}
              />
            )}
            <ul className="flex flex-col gap-2">
              <li>
                <Option active={draft.teacherId === null} onClick={() => set('teacherId', null)}>
                  <span className="font-semibold">Sin profesor por ahora</span>
                </Option>
              </li>
              {teacherList.map((t) => {
                const problem = teacherAvailability(t.id, groupId, draft)
                const active = draft.teacherId === t.id
                return (
                  <li key={t.id}>
                    <Option
                      active={active}
                      disabled={Boolean(problem) && !active}
                      onClick={() => set('teacherId', t.id)}
                    >
                      <span className="font-semibold">{fullName(t)}</span>
                      <span className="text-xs text-muted">{problem ?? `Enseña ${t.levels.join(', ')}`}</span>
                    </Option>
                  </li>
                )
              })}
              {teachers.length === 0 && (
                <li className="text-sm text-muted">Crea los profesores en la pestaña «Profesores».</li>
              )}
            </ul>
            {draft.teacherId && teacherAvailability(draft.teacherId, groupId, draft) && (
              <Warning>{teacherAvailability(draft.teacherId, groupId, draft)}</Warning>
            )}
          </Section>

          {/* 4. Alumnos */}
          <Section
            n={4}
            title={`Alumnos (${draft.studentIds.length}${room?.capacity ? ` de ${room.capacity}` : ''})`}
          >
            {overCapacity && <Warning>Hay más alumnos que el cupo del salón.</Warning>}
            {selected.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
                {selected.map((s, i) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      {i + 1}. <span className="font-semibold">{fullName(s)}</span>{' '}
                      <span className="text-xs text-muted">
                        {s.docType} {maskDocument(s.docNumber)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          'studentIds',
                          draft.studentIds.filter((id) => id !== s.id),
                        )
                      }
                      aria-label={`Quitar a ${fullName(s)}`}
                      className="grid h-9 w-9 place-items-center rounded-full text-lg text-muted hover:bg-accent-soft hover:text-accent"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Todavía no hay alumnos en este grupo.</p>
            )}

            <div className="rounded-xl border border-dashed border-line bg-white p-3">
              <input
                type="search"
                placeholder="Buscar alumno por nombre o últimos dígitos del documento"
                aria-label="Buscar alumno para agregar"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className={fieldClass}
              />
              <p className="mt-2 text-xs text-muted">
                {studentSearch.trim()
                  ? 'Resultados (si el alumno está en otro grupo, se moverá a este):'
                  : 'Alumnos sin grupo:'}
              </p>
              <ul className="mt-1 flex flex-col">
                {candidates.map((s) => {
                  const other = groupById(s.groupId)
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => set('studentIds', [...draft.studentIds, s.id])}
                        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm hover:bg-surface"
                      >
                        <span>
                          <span className="font-semibold">{fullName(s)}</span>{' '}
                          <span className="text-xs text-muted">
                            {s.docType} {maskDocument(s.docNumber)}
                            {other ? ` · ahora en ${other.name}` : ''}
                          </span>
                        </span>
                        <span className="font-bold text-brand">+ Agregar</span>
                      </button>
                    </li>
                  )
                })}
                {candidates.length === 0 && (
                  <li className="px-2 py-2 text-sm text-muted">
                    {studentSearch.trim() ? 'No se encontró ningún alumno.' : 'No hay alumnos sin grupo.'}
                  </li>
                )}
              </ul>
            </div>
          </Section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-line bg-white px-6 py-4">
          {error && (
            <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={group?.published ? 'primary' : 'secondary'}
              onClick={() => save(false)}
            >
              {group?.published ? 'Guardar cambios' : 'Guardar borrador'}
            </Button>
            {!group?.published && (
              <Button type="button" onClick={() => save(true)} disabled={!draft.teacherId}>
                Guardar y publicar
              </Button>
            )}
          </div>
          {!group?.published && !draft.teacherId && (
            <p className="text-right text-xs text-muted">Para publicar, elige un profesor.</p>
          )}
        </footer>
      </aside>
    </div>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
      <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-sm text-white">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 min-w-14 rounded-lg border px-4 text-sm font-extrabold transition ${
        active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:bg-surface'
      }`}
    >
      {children}
    </button>
  )
}

function Option({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-12 w-full flex-col items-start justify-center rounded-xl border px-4 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'border-brand bg-brand-soft ring-2 ring-brand/30' : 'border-line bg-white hover:border-brand'
      }`}
    >
      {children}
    </button>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm font-semibold text-warn" role="status">
      {children}
    </p>
  )
}
