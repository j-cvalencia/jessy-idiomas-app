import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'
import {
  dayOfDate,
  fullName,
  lessonLabel,
  longDateLabel,
  publishedLesson,
  scheduleLabel,
  studentsOfGroup,
  todayISO,
  useMockData,
  type Group,
} from '@/lib/mock-data'

/** Tarjeta 5.3: lo que ve el profesor al entrar. Solo sus grupos, su horario y la clase de la semana. */
export function TeacherHomePage() {
  const { profile } = useAuth()
  const { groups, attendance } = useMockData()
  const today = todayISO()
  const mine = groups.filter((g) => g.teacherId === profile?.id)
  const todays = mine.filter((g) => g.days.includes(dayOfDate(today)))

  if (mine.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-black">Hola, {profile?.first_name}</h1>
        <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-ink-soft">
          Todavía no tienes grupos asignados. Cuando la academia te asigne uno, aparecerá aquí con su horario
          y la clase de cada semana.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl font-black">Hola, {profile?.first_name}</h1>
        <p className="mt-1 text-sm text-ink-soft first-letter:uppercase">{longDateLabel(today)}</p>
      </header>

      <div>
        <h2 className="font-display text-xl font-extrabold">Clases de hoy</h2>
        {todays.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white p-5 text-sm text-ink-soft ring-1 ring-line">
            Hoy no tienes clases.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {todays.map((g) => {
              const taken = attendance.some((a) => a.groupId === g.id && a.date === today)
              return (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink p-5 text-white"
                >
                  <div>
                    <p className="font-display text-lg font-extrabold">{g.name}</p>
                    <p className="text-sm text-slate-300">{scheduleLabel(g)}</p>
                  </div>
                  <Link
                    to={`/profesor/asistencia/${g.id}`}
                    className={`inline-flex min-h-11 items-center rounded-xl px-5 font-bold ${
                      taken ? 'bg-white/15 text-white' : 'bg-accent text-white'
                    }`}
                  >
                    {taken ? 'Asistencia tomada ✓' : 'Tomar asistencia'}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="font-display text-xl font-extrabold">Mis grupos</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {mine.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      </div>
    </section>
  )
}

function GroupCard({ group }: { group: Group }) {
  const lesson = publishedLesson(group)
  const students = studentsOfGroup(group.id)

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-extrabold">
            <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-extrabold text-white">
              {group.level}
            </span>
            {group.name}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{scheduleLabel(group)}</p>
        </div>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">
          {students.length} alumnos
        </span>
      </div>

      <div className={`rounded-xl p-4 ${lesson ? 'bg-ok-soft' : 'bg-surface'}`}>
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Clase de esta semana</p>
        {lesson ? (
          <p className="mt-1 font-semibold">
            {lessonLabel(lesson)} · {lesson.topic}
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">
            La academia aún no ha publicado la clase de esta semana.
          </p>
        )}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-sm font-bold text-brand">Ver lista de alumnos</summary>
        <ol className="mt-2 list-decimal pl-5 text-sm">
          {students.map((s) => (
            <li key={s.id} className="py-0.5">
              {fullName(s)}
            </li>
          ))}
          {students.length === 0 && <li className="list-none text-muted">Sin alumnos todavía.</li>}
        </ol>
      </details>

      <Link
        to={`/profesor/asistencia/${group.id}`}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line font-bold hover:bg-surface"
      >
        Asistencia
      </Link>
    </article>
  )
}
