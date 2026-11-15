import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'
import { useMockData } from '@/lib/mock-data'

interface Detail {
  label: string
  value: number
  /** Resalta el dato cuando requiere atención del director. */
  alert?: boolean
}

interface SummaryCardProps {
  to: string
  title: string
  value: number
  unit: string
  details: Detail[]
  action: string
}

function SummaryCard({ to, title, value, unit, details, action}: SummaryCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-5 rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">{title}</h2>
      </div>

      <p className="font-display text-6xl font-black leading-none tabular-nums">
        {value}
        <span className="ml-2 text-base font-bold text-muted">{unit}</span>
      </p>

      <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
        {details.map((d) => (
          <div key={d.label} className="flex items-center justify-between gap-3">
            <dt className="text-ink-soft">{d.label}</dt>
            <dd
              className={`rounded-full px-2.5 py-0.5 font-bold tabular-nums ${
                d.alert && d.value > 0 ? 'bg-warn-soft text-warn' : 'bg-surface text-ink'
              }`}
            >
              {d.value}
            </dd>
          </div>
        ))}
      </dl>

      <span className="mt-auto text-sm font-bold text-brand underline-offset-4 group-hover:underline">
        {action}
      </span>
    </Link>
  )
}

export function DirectorHomePage() {
  const { profile } = useAuth()
  const { students, groups, teachers } = useMockData()

  const activeStudents = students.filter((s) => s.active)
  const withoutGroup = activeStudents.filter((s) => s.groupId === null).length
  const inactive = students.length - activeStudents.length

  const groupsWithTeacher = groups.filter((g) => g.teacherId !== null).length
  const groupsWithoutTeacher = groups.length - groupsWithTeacher

  const teachersWithGroups = teachers.filter((t) => groups.some((g) => g.teacherId === t.id)).length
  const teachersFree = teachers.length - teachersWithGroups

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl font-black">Hola, {profile?.first_name}</h1>
        <p className="mt-1 text-sm text-ink-soft">Así está la academia hoy. Toca una tarjeta para entrar a esa sección.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        <SummaryCard
          to="/director/estudiantes"
          title="Estudiantes"
          value={activeStudents.length}
          unit="activos"
          details={[
            { label: 'Con grupo', value: activeStudents.length - withoutGroup },
            { label: 'Sin grupo', value: withoutGroup, alert: true },
            { label: 'Inactivos', value: inactive },
          ]}
          action="Ver estudiantes"
        />

        <SummaryCard
          to="/director/grupos"
          title="Grupos"
          value={groups.length}
          unit={groups.length === 1 ? 'grupo' : 'grupos'}
          details={[
            { label: 'Con profesor', value: groupsWithTeacher },
            { label: 'Sin profesor', value: groupsWithoutTeacher, alert: true },
          ]}
          action="Ver grupos"
        />

        <SummaryCard
          to="/director/grupos"
          title="Profesores"
          value={teachers.length}
          unit={teachers.length === 1 ? 'profesor' : 'profesores'}
          details={[
            { label: 'Con grupos a cargo', value: teachersWithGroups },
            { label: 'Sin grupos', value: teachersFree },
          ]}
          action="Ver profesores"
        />
      </div>
    </section>
  )
}
