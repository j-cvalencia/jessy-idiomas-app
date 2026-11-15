import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/auth-context'
import {
  attendanceOn,
  dayOfDate,
  fullName,
  longDateLabel,
  saveAttendance,
  scheduleLabel,
  studentsOfGroup,
  todayISO,
  useMockData,
} from '@/lib/mock-data'

/** Tarjeta 5.4: el profesor marca quién vino. Pensada para el celular. */
export function AttendancePage() {
  const { groupId = '' } = useParams()
  const { profile } = useAuth()
  const { groups } = useMockData()
  const group = groups.find((g) => g.id === groupId && g.teacherId === profile?.id && g.published)
  const today = todayISO()
  const [date, setDate] = useState(today)

  if (!group) return <Navigate to="/profesor" replace />
  return (
    <AttendanceForm
      key={`${group.id}-${date}`}
      groupId={group.id}
      date={date}
      onDate={setDate}
      today={today}
    />
  )
}

function AttendanceForm({
  groupId,
  date,
  onDate,
  today,
}: {
  groupId: string
  date: string
  onDate: (d: string) => void
  today: string
}) {
  const { groups } = useMockData()
  const group = groups.find((g) => g.id === groupId)!
  const students = studentsOfGroup(groupId)
  const saved = useMemo(() => attendanceOn(groupId, date), [groupId, date])
  const alreadyTaken = Object.keys(saved).length > 0
  // Si no se ha tomado, todos empiezan como presentes: el profesor solo marca a los que faltaron.
  const [marks, setMarks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(students.map((s) => [s.id, saved[s.id] ?? true])),
  )
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const present = students.filter((s) => marks[s.id]).length
  const isClassDay = group.days.includes(dayOfDate(date))

  function save() {
    const result = saveAttendance(groupId, date, marks)
    setMessage(
      result.ok
        ? { ok: true, text: `Asistencia guardada: ${present} de ${students.length} presentes.` }
        : { ok: false, text: result.error },
    )
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-5">
      <Link to="/profesor" className="text-sm font-semibold text-brand">
        ← Mis clases
      </Link>

      <header>
        <h1 className="font-display text-3xl font-black">Asistencia</h1>
        <p className="mt-1 text-ink-soft">
          {group.name} · {scheduleLabel(group)}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="att-date" className="text-sm font-semibold">
          Clase del día
        </label>
        <input
          id="att-date"
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onDate(e.target.value)}
          className="min-h-12 rounded-lg border border-line bg-white px-3.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <span className="block text-sm text-muted first-letter:uppercase">{longDateLabel(date)}</span>
        {!isClassDay && (
          <span className="rounded-lg bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
            Este grupo no tiene clase ese día. Revisa la fecha.
          </span>
        )}
        {alreadyTaken && (
          <span className="text-sm font-semibold text-ok">
            Ya se tomó asistencia este día; puedes corregirla.
          </span>
        )}
      </div>

      {students.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-ink-soft ring-1 ring-line">
          Este grupo no tiene alumnos.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">
              {present} de {students.length} presentes
            </span>
            <button
              type="button"
              onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, true])))}
              className="min-h-11 px-2 font-semibold text-brand hover:underline"
            >
              Todos presentes
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {students.map((s) => {
              const here = marks[s.id]
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={here}
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: !m[s.id] }))}
                    className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left transition ${
                      here ? 'border-ok/30 bg-ok-soft' : 'border-accent/30 bg-accent-soft'
                    }`}
                  >
                    <span className="font-semibold">{fullName(s)}</span>
                    <span className={`text-sm font-extrabold ${here ? 'text-ok' : 'text-accent'}`}>
                      {here ? 'Presente' : 'Faltó'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {message && (
            <p
              role={message.ok ? 'status' : 'alert'}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                message.ok ? 'bg-ok-soft text-ok' : 'bg-accent-soft text-accent'
              }`}
            >
              {message.text}
            </p>
          )}

          <Button onClick={save} className="sticky bottom-4 shadow-lg">
            Guardar asistencia
          </Button>
        </>
      )}
    </section>
  )
}
