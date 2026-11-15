import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { maskDocument } from '@/lib/document'
import { PaymentBadge } from '@/features/payments/PaymentBadge'
import { fullName, scheduleLabel, studentAttendance, teacherShortName, useMockData } from '@/lib/mock-data'
import { usePersistentState } from '@/lib/use-persistent-state'
import type { Student } from '@/lib/mock-data'
import { StudentEditor } from './StudentEditor'

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const fieldClass =
  'min-h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

export function StudentsPage() {
  const { students, groups, teachers } = useMockData()
  // undefined = panel cerrado; null = estudiante nuevo.
  const [editing, setEditing] = useState<Student | null | undefined>(undefined)
  const [notice, setNotice] = useState<string | null>(null)
  // Los filtros se recuerdan al cambiar de pantalla y volver.
  const [query, setQuery] = usePersistentState('estudiantes.busqueda', '')
  const [savedGroupId, setGroupId] = usePersistentState('estudiantes.grupo', 'all')
  const [status, setStatus] = usePersistentState('estudiantes.estado', 'all')
  // Si el grupo guardado ya no existe (lo eliminaron), se vuelve a "Todos los grupos".
  const groupId =
    savedGroupId === 'all' || savedGroupId === 'none' || groups.some((g) => g.id === savedGroupId)
      ? savedGroupId
      : 'all'
  const hasFilters = query !== '' || groupId !== 'all' || status !== 'all'

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    return students.filter((s) => {
      if (q && !normalize(fullName(s)).includes(q) && !s.docNumber.endsWith(q)) return false
      if (groupId === 'none' ? s.groupId !== null : groupId !== 'all' && s.groupId !== groupId) return false
      if (status === 'active' && !s.active) return false
      if (status === 'inactive' && s.active) return false
      return true
    })
  }, [students, query, groupId, status])

  const activeCount = students.filter((s) => s.active).length

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black">Estudiantes</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {activeCount} estudiantes activos · {students.length} en total
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>+ Nuevo estudiante</Button>
      </header>

      {notice && (
        <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o últimos dígitos del documento"
          aria-label="Buscar estudiante"
          className={`${fieldClass} min-w-64 flex-1`}
        />
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          aria-label="Filtrar por grupo"
          className={fieldClass}
        >
          <option value="all">Todos los grupos</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value="none">Sin grupo</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filtrar por estado"
          className={fieldClass}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setGroupId('all')
              setStatus('all')
            }}
            className="min-h-11 px-2 text-sm font-semibold text-brand hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Estudiante</th>
                <th className="px-3 py-3 font-semibold">Documento</th>
                <th className="px-3 py-3 font-semibold">Grupo</th>
                <th className="px-3 py-3 font-semibold">Profesor</th>
                <th className="px-3 py-3 font-semibold">Asistencia</th>
                <th className="px-3 py-3 font-semibold">Pago</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                // El grupo y el profesor se leen de lo que el director asignó en "Grupos y profesores".
                const group = groups.find((g) => g.id === s.groupId)
                const teacher = group ? teachers.find((t) => t.id === group.teacherId) : undefined
                return (
                  <tr key={s.id} className={`border-t border-line ${s.active ? '' : 'opacity-60'}`}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold">{fullName(s)}</p>
                      <p className="text-xs text-muted">
                        {s.phone}
                        {s.email ? ` · ${s.email}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 tabular-nums text-ink-soft">
                      {s.docType} {maskDocument(s.docNumber)}
                    </td>
                    <td className="px-3 py-3.5">
                      {group ? (
                        <span className="inline-flex flex-col">
                          <span className="inline-flex items-center gap-2 font-medium">
                            <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-extrabold text-white">
                              {group.level}
                            </span>
                            {group.name}
                          </span>
                          <span className="mt-0.5 text-xs text-muted">{scheduleLabel(group)}</span>
                        </span>
                      ) : (
                        <span className="text-muted">Sin grupo</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-ink-soft">
                      {group ? teacherShortName(teacher) : <span className="text-muted">—</span>}
                    </td>
                    <td
                      className={`px-3 py-3.5 font-semibold tabular-nums ${studentAttendance(s) < 75 ? 'text-accent' : ''}`}
                    >
                      {studentAttendance(s)}%
                    </td>
                    <td className="px-3 py-3.5">
                      {s.active ? (
                        <PaymentBadge student={s} withDetail />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      {s.active ? (
                        <span className="rounded-full bg-ok-soft px-3 py-1 text-xs font-bold text-ok">
                          Activo
                        </span>
                      ) : (
                        <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null)
                          setEditing(s)
                        }}
                        className="min-h-9 rounded-lg border border-line px-3 text-xs font-bold hover:border-brand hover:text-brand"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted">
                    No hay estudiantes con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== undefined && (
        <StudentEditor
          key={editing?.id ?? 'nuevo'}
          student={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(text) => {
            setEditing(undefined)
            setNotice(text)
          }}
        />
      )}
    </section>
  )
}
