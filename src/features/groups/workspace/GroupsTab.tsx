import { Button } from '@/components/ui/Button'
import {
  deleteGroup,
  fullName,
  publishGroup,
  roomById,
  scheduleLabel,
  studentsOfGroup,
  teacherById,
  unpublishGroup,
  useMockData,
  type Group,
} from '@/lib/mock-data'
import type { Notice } from './shared'

interface Props {
  onEdit: (group: Group | null) => void
  onNotice: (n: Notice) => void
}

/** Lista de grupos como tarjetas de solo lectura. Todo cambio se hace con «Editar». */
export function GroupsTab({ onEdit, onNotice }: Props) {
  const { groups } = useMockData()
  const drafts = groups.filter((g) => !g.published)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {drafts.length > 0
            ? `${drafts.length} ${drafts.length === 1 ? 'grupo está' : 'grupos están'} en borrador: el profesor aún no los ve.`
            : 'Todos los grupos están publicados.'}
        </p>
        <Button onClick={() => onEdit(null)}>+ Nuevo grupo</Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <p className="font-semibold">Todavía no hay grupos.</p>
          <p className="mt-1 text-sm text-muted">
            Crea primero los profesores y los salones, y luego arma cada grupo con «Nuevo grupo».
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} onEdit={() => onEdit(g)} onNotice={onNotice} />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupCard({
  group,
  onEdit,
  onNotice,
}: {
  group: Group
  onEdit: () => void
  onNotice: (n: Notice) => void
}) {
  const teacher = teacherById(group.teacherId)
  const room = roomById(group.roomId)
  const students = studentsOfGroup(group.id)

  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 ${group.published ? 'border-line' : 'border-dashed border-warn'}`}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-xl font-extrabold">
          <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-extrabold text-white">
            {group.level}
          </span>
          {group.name}
        </h3>
        {group.published ? (
          <span className="rounded-full bg-ok-soft px-3 py-1 text-xs font-bold text-ok">Publicado</span>
        ) : (
          <span className="rounded-full bg-warn-soft px-3 py-1 text-xs font-bold text-warn">Borrador</span>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Item label="Profesor" value={teacher ? fullName(teacher) : 'Sin asignar'} missing={!teacher} />
        <Item label="Salón" value={room?.name ?? 'Sin salón'} missing={!room} />
        <Item label="Horario" value={group.days.length ? scheduleLabel(group) : 'Sin horario'} wide />
        <Item
          label="Alumnos"
          value={
            students.length
              ? `${students.length}: ${students
                  .slice(0, 4)
                  .map((s) => s.firstName)
                  .join(', ')}${students.length > 4 ? '…' : ''}`
              : 'Sin alumnos'
          }
          missing={students.length === 0}
          wide
        />
      </dl>

      <footer className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button onClick={onEdit}>Editar</Button>
        {group.published ? (
          <Button
            variant="secondary"
            onClick={() => {
              unpublishGroup(group.id)
              onNotice({ kind: 'ok', text: `${group.name} volvió a borrador: el profesor ya no lo ve.` })
            }}
          >
            Pasar a borrador
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              const r = publishGroup(group.id)
              onNotice(
                r.ok
                  ? { kind: 'ok', text: `Se publicó ${group.name}. El profesor ya lo ve.` }
                  : { kind: 'error', text: r.error },
              )
            }}
          >
            Publicar
          </Button>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`¿Eliminar el grupo ${group.name}? Sus alumnos quedarán sin grupo.`)) {
              deleteGroup(group.id)
              onNotice({ kind: 'ok', text: `Se eliminó ${group.name}.` })
            }
          }}
          className="ml-auto text-xs font-semibold text-muted underline underline-offset-2 hover:text-accent"
        >
          Eliminar grupo
        </button>
      </footer>
    </article>
  )
}

function Item({
  label,
  value,
  missing,
  wide,
}: {
  label: string
  value: string
  missing?: boolean
  wide?: boolean
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 font-medium ${missing ? 'text-warn' : ''}`}>{value}</dd>
    </div>
  )
}
