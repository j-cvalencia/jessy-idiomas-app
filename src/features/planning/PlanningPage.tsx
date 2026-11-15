import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import {
  acceptSuggestions as applySuggestions,
  lessonLabel,
  lessonsOfLevel,
  publishAll,
  scheduleLabel,
  setGroupPlan,
  suggestedLessonNumber,
  teacherShortName,
  useMockData,
  type Group,
  paymentState,
  studentAttendance,
} from '@/lib/mock-data'

/** "Semana del 9 al 13 de noviembre" (lunes a viernes de la semana actual). */
function weekLabel(today = new Date()): string {
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() + (day === 0 ? 1 : 1 - day))
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const month = (d: Date) => d.toLocaleDateString('es-CO', { month: 'long' })
  const full = (d: Date) => `${d.getDate()} de ${month(d)}`
  return monday.getMonth() === friday.getMonth()
    ? `Semana del ${monday.getDate()} al ${friday.getDate()} de ${month(friday)}`
    : `Semana del ${full(monday)} al ${full(friday)}`
}

function LessonSelect({
  group,
  value,
  onChange,
}: {
  group: Group
  value: number
  onChange: (lesson: number) => void
}) {
  const options = lessonsOfLevel(group.level)
  const current = options.find((l) => l.number === value) ?? options[0]

  return (
    <div className="relative inline-flex min-w-52 items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-brand/30">
      <span className="truncate">
        <strong>{lessonLabel(current)}</strong> <span className="text-ink-soft">{current.topic}</span>
      </span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select
        aria-label={`Clase de esta semana para ${group.name}`}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((l) => (
          <option key={l.number} value={l.number}>
            {lessonLabel(l)} · {l.topic}
          </option>
        ))}
      </select>
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix,
  alert,
}: {
  label: string
  value: number | string
  suffix?: string
  alert?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${alert ? 'border-red-200 bg-accent-soft' : 'border-line bg-white'}`}
    >
      <p className={`text-xs font-semibold ${alert ? 'text-accent' : 'text-ink-soft'}`}>{label}</p>
      <p className={`mt-1 font-display text-3xl font-black ${alert ? 'text-accent' : ''}`}>
        {value}
        {suffix && <span className="ml-1.5 text-base font-bold text-muted">{suffix}</span>}
      </p>
    </div>
  )
}

export function PlanningPage() {
  const { groups, students, teachers } = useMockData()
  const [message, setMessage] = useState<string | null>(null)

  const stats = useMemo(() => {
    const active = students.filter((s) => s.active)
    const avg = active.reduce((sum, s) => sum + studentAttendance(s), 0) / (active.length || 1)
    return {
      active: active.length,
      attendance: Math.round(avg),
      pending: active.filter((s) => ['vencido', 'sin_pago'].includes(paymentState(s))).length,
    }
  }, [students])

  const drafts = groups.filter((g) => g.status === 'draft').length

  function changeLesson(group: Group, lesson: number) {
    setMessage(null)
    setGroupPlan(group.id, lesson, 'draft')
  }

  function acceptSuggestions() {
    applySuggestions()
    setMessage('Se aplicaron las clases sugeridas. Revisa y publica.')
  }

  function publish() {
    const withoutTeacher = groups.filter((g) => !g.teacherId).length
    const count = publishAll()
    setMessage(
      `Se publicaron ${count} planificaciones a los profesores.` +
        (withoutTeacher > 0 ? ` Ojo: ${withoutTeacher} grupo(s) todavía no tienen profesor asignado.` : ''),
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-wide text-accent">{weekLabel()}</p>
        <h1 className="mt-1 font-display text-4xl font-black">Planificación semanal</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Elige la clase de cada grupo. La plataforma sugiere la siguiente según el orden del currículo.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={acceptSuggestions} disabled={groups.length === 0}>
            Aceptar sugerencias
          </Button>
          <Button onClick={publish} disabled={drafts === 0}>
            Publicar a profesores
          </Button>
        </div>
        <p role="status" className="mt-3 min-h-5 text-sm font-semibold text-ok">
          {message}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Estudiantes activos" value={stats.active} />
        <StatCard label="Clases publicadas" value={groups.length - drafts} suffix={`de ${groups.length}`} />
        <StatCard label="Asistencia promedio" value={`${stats.attendance}%`} />
        <StatCard label="Pagos pendientes" value={stats.pending} alert />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="font-display text-xl font-extrabold">Grupos y clase asignada</h2>
          <span className="text-xs text-muted">Datos de ejemplo</span>
        </div>

        {groups.length === 0 ? (
          <p className="border-t border-line px-5 py-10 text-center text-sm text-muted">
            Todavía no hay grupos. Créalos en{' '}
            <Link to="/director/grupos" className="font-bold text-brand underline underline-offset-4">
              Grupos y profesores
            </Link>{' '}
            y aparecerán aquí.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Grupo</th>
                  <th className="px-3 py-3 font-semibold">Horario</th>
                  <th className="px-3 py-3 font-semibold">Profesor</th>
                  <th className="px-3 py-3 font-semibold">Clase de esta semana</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const isSuggested = group.plannedLessonNumber === suggestedLessonNumber(group)
                  const members = students.filter((s) => s.active && s.groupId === group.id).length
                  const teacher = teachers.find((t) => t.id === group.teacherId)
                  return (
                    <tr key={group.id} className="border-t border-line">
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-3 font-semibold">
                          <span className="rounded-md bg-ink px-3 py-1.5 text-xs font-extrabold text-white">
                            {group.level}
                          </span>
                          <span>
                            {group.name}
                            <span className="block text-xs font-normal text-muted">{members} alumnos</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-4 text-ink-soft">{scheduleLabel(group)}</td>
                      <td className="px-3 py-4">{teacherShortName(teacher)}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <LessonSelect
                            group={group}
                            value={group.plannedLessonNumber}
                            onChange={(n) => changeLesson(group, n)}
                          />
                          {isSuggested && (
                            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-dark">
                              Sugerida
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {group.status === 'published' ? (
                          <span className="rounded-full bg-ok-soft px-3 py-1 text-xs font-bold text-ok">
                            Publicada
                          </span>
                        ) : (
                          <span className="rounded-full bg-warn-soft px-3 py-1 text-xs font-bold text-warn">
                            Borrador
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
