import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { DocumentInput } from '@/components/ui/DocumentInput'
import {
  createStudent,
  fullName,
  groupById,
  updateStudent,
  type Student,
  type StudentChanges,
} from '@/lib/mock-data'

const fieldClass =
  'min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

interface Props {
  /** Estudiante a editar, o null para registrar uno nuevo. */
  student: Student | null
  onClose: () => void
  onSaved: (text: string) => void
}

/** Panel para registrar un estudiante o actualizar sus datos (teléfono, correo, acudiente, estado). */
export function StudentEditor({ student, onClose, onSaved }: Props) {
  const [data, setData] = useState<StudentChanges>(() => ({
    firstName: student?.firstName ?? '',
    lastName: student?.lastName ?? '',
    docType: student?.docType ?? 'CC',
    docNumber: student?.docNumber ?? '',
    phone: student?.phone ?? '',
    email: student?.email ?? '',
    guardianName: student?.guardianName ?? '',
    guardianPhone: student?.guardianPhone ?? '',
    active: student?.active ?? true,
  }))
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof StudentChanges>(key: K, value: StudentChanges[K]) => {
    setError(null)
    setData((d) => ({ ...d, [key]: value }))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const group = student ? groupById(student.groupId) : undefined
  const leavingGroup = student?.active && !data.active && group

  function submit(e: FormEvent) {
    e.preventDefault()
    const result = student ? updateStudent(student.id, data) : createStudent(data)
    if (!result.ok) return setError(result.error)
    const name = `${data.firstName.trim()} ${data.lastName.trim()}`
    onSaved(
      student ? `Se actualizaron los datos de ${name}.` : `Se registró a ${name}. Ahora asígnale un grupo.`,
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/50" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-editor-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="flex h-full w-full max-w-xl flex-col bg-surface shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-6 py-4">
          <h2 id="student-editor-title" className="font-display text-2xl font-extrabold">
            {student ? `Editar ${fullName(student)}` : 'Nuevo estudiante'}
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
          <Section title="Datos personales">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombres">
                <input
                  value={data.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label="Apellidos">
                <input
                  value={data.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label="Tipo de documento">
                <select
                  value={data.docType}
                  onChange={(e) => set('docType', e.target.value as 'CC' | 'TI')}
                  className={fieldClass}
                >
                  <option value="CC">Cédula (CC)</option>
                  <option value="TI">Tarjeta de identidad (TI)</option>
                </select>
              </Field>
              <DocumentInput
                id="st-doc"
                label="Número de documento"
                value={data.docNumber}
                onChange={(v) => set('docNumber', v)}
              />
            </div>
          </Section>

          <Section title="Contacto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Teléfono / WhatsApp">
                <input
                  type="tel"
                  inputMode="tel"
                  value={data.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label="Correo (opcional)">
                <input
                  type="email"
                  value={data.email ?? ''}
                  onChange={(e) => set('email', e.target.value)}
                  className={fieldClass}
                />
              </Field>
            </div>
          </Section>

          <Section
            title={data.docType === 'TI' ? 'Acudiente (obligatorio para menores)' : 'Acudiente (opcional)'}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre del acudiente">
                <input
                  value={data.guardianName ?? ''}
                  onChange={(e) => set('guardianName', e.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label="Teléfono del acudiente">
                <input
                  type="tel"
                  inputMode="tel"
                  value={data.guardianPhone ?? ''}
                  onChange={(e) => set('guardianPhone', e.target.value)}
                  className={fieldClass}
                />
              </Field>
            </div>
          </Section>

          {student && (
            <Section title="Estado">
              <div className="flex flex-wrap gap-2">
                {[
                  [true, 'Activo'],
                  [false, 'Inactivo (se retiró)'],
                ].map(([value, label]) => (
                  <button
                    key={String(value)}
                    type="button"
                    aria-pressed={data.active === value}
                    onClick={() => set('active', value as boolean)}
                    className={`min-h-11 rounded-lg border px-4 text-sm font-bold ${
                      data.active === value
                        ? 'border-ink bg-ink text-white'
                        : 'border-line bg-white hover:bg-surface'
                    }`}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
              {leavingGroup && (
                <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
                  Al guardar, saldrá del grupo {group!.name}.
                </p>
              )}
            </Section>
          )}
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
            <Button type="submit">{student ? 'Guardar cambios' : 'Registrar estudiante'}</Button>
          </div>
        </footer>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
      <h3 className="font-display text-lg font-extrabold">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      {children}
    </label>
  )
}
