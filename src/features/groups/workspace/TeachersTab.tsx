import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { DocumentInput } from '@/components/ui/DocumentInput'
import { TextInput } from '@/components/ui/TextInput'
import { isValidDocument, maskDocument, normalizeDocument } from '@/lib/document'
import {
  LEVELS,
  createTeacher,
  deleteTeacher,
  fullName,
  resetTeacherPassword,
  studentsOfGroup,
  useMockData,
  updateTeacher,
  type Level,
  type Teacher,
} from '@/lib/mock-data'
import { fieldClass, matches, type Notice } from './shared'

/** Profesores: crearlos (con usuario y clave inicial), ver qué dictan y restablecer su clave. */
export function TeachersTab({ onNotice }: { onNotice: (n: Notice) => void }) {
  const { teachers, groups } = useMockData()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const list = teachers.filter((t) => matches(t, search))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Cada profesor entra con su usuario. Su clave inicial es su documento y la cambia la primera vez.
        </p>
        <Button onClick={() => setCreating(!creating)} variant={creating ? 'secondary' : 'primary'}>
          {creating ? 'Cerrar' : '+ Nuevo profesor'}
        </Button>
      </div>

      {creating && (
        <TeacherForm
          onDone={(name, username) => {
            setCreating(false)
            onNotice({
              kind: 'ok',
              text: `Se creó a ${name}. Usuario: ${username} · Clave inicial: su número de documento.`,
            })
          }}
        />
      )}

      {teachers.length > 5 && (
        <input
          type="search"
          placeholder="Buscar profesor"
          aria-label="Buscar profesor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${fieldClass} max-w-md`}
        />
      )}

      {teachers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-muted">
          Todavía no hay profesores. Crea el primero con «Nuevo profesor».
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.map((t) => {
            const mine = groups.filter((g) => g.teacherId === t.id)
            const total = mine.reduce((n, g) => n + studentsOfGroup(g.id).length, 0)
            if (editingId === t.id) {
              return (
                <li key={t.id} className="lg:col-span-2">
                  <TeacherForm
                    teacher={t}
                    onCancel={() => setEditingId(null)}
                    onDone={(name) => {
                      setEditingId(null)
                      onNotice({ kind: 'ok', text: `Se actualizaron los datos de ${name}.` })
                    }}
                  />
                </li>
              )
            }
            return (
              <li key={t.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-extrabold">{fullName(t)}</p>
                    <p className="text-xs text-muted">
                      CC {maskDocument(t.docNumber)} · {t.phone}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold">{t.username}</p>
                    {t.mustChangePassword && <p className="text-xs text-warn">Clave inicial: su documento</p>}
                  </div>
                </div>
                <p className="text-sm">
                  <span className="text-muted">Enseña: </span>
                  <span className="font-semibold">{t.levels.join(' · ')}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted">Grupos: </span>
                  {mine.length ? (
                    <span className="font-semibold">
                      {mine.map((g) => g.name).join(' · ')} ({total} alumnos)
                    </span>
                  ) : (
                    <span className="text-warn">Sin grupos</span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-4 border-t border-line pt-3 text-xs font-semibold">
                  <Button variant="secondary" onClick={() => setEditingId(t.id)}>
                    Editar datos
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      resetTeacherPassword(t.id)
                      onNotice({ kind: 'ok', text: `La clave de ${fullName(t)} volvió a ser su documento.` })
                    }}
                    className="text-muted underline underline-offset-2 hover:text-brand"
                  >
                    Restablecer clave
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar a ${fullName(t)}? Sus grupos quedarán sin profesor.`)) {
                        deleteTeacher(t.id)
                        onNotice({ kind: 'ok', text: `Se eliminó a ${fullName(t)}.` })
                      }
                    }}
                    className="text-muted underline underline-offset-2 hover:text-accent"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Crear profesor (sin `teacher`) o editar sus datos (con `teacher`). */
function TeacherForm({
  teacher,
  onDone,
  onCancel,
}: {
  teacher?: Teacher
  onDone: (name: string, username: string) => void
  onCancel?: () => void
}) {
  const [firstName, setFirstName] = useState(teacher?.firstName ?? '')
  const [lastName, setLastName] = useState(teacher?.lastName ?? '')
  const [phone, setPhone] = useState(teacher?.phone ?? '')
  const [document, setDocument] = useState(teacher?.docNumber ?? '')
  const [levels, setLevels] = useState<Level[]>(teacher?.levels ?? [])
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return setError('Escribe nombres y apellidos.')
    if (phone.replace(/\D/g, '').length < 7) return setError('Revisa el teléfono.')
    if (!isValidDocument(document)) return setError('Revisa el número de documento.')
    if (levels.length === 0) return setError('Elige al menos un nivel que pueda enseñar.')
    const data = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      docNumber: normalizeDocument(document),
      levels: LEVELS.filter((l) => levels.includes(l)),
    }
    if (teacher) {
      const result = updateTeacher(teacher.id, data)
      if (!result.ok) return setError(result.error)
      return onDone(`${data.firstName} ${data.lastName}`, teacher.username)
    }
    const result = createTeacher(data)
    if (!result.ok) return setError(result.error)
    onDone(`${data.firstName} ${data.lastName}`, result.username)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-brand/30 bg-white p-5">
      {teacher && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-extrabold">Editar datos de {fullName(teacher)}</h3>
          <span className="text-xs text-muted">
            Usuario: <span className="font-mono font-bold">{teacher.username}</span> (no cambia)
          </span>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          id={teacher ? `et-first-${teacher.id}` : 'nt-first'}
          label="Nombres"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <TextInput
          id={teacher ? `et-last-${teacher.id}` : 'nt-last'}
          label="Apellidos"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <TextInput
          id={teacher ? `et-phone-${teacher.id}` : 'nt-phone'}
          label="Teléfono"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <DocumentInput
          id={teacher ? `et-doc-${teacher.id}` : 'nt-doc'}
          label={teacher ? 'Documento' : 'Documento (será su clave inicial)'}
          value={document}
          onChange={setDocument}
        />
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Niveles que puede enseñar</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={levels.includes(level)}
              onClick={() =>
                setLevels((prev) =>
                  prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
                )
              }
              className={`min-h-11 min-w-14 rounded-lg border px-4 text-sm font-extrabold ${
                levels.includes(level)
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white hover:bg-surface'
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
        <Button type="submit">{teacher ? 'Guardar cambios' : 'Crear profesor'}</Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
