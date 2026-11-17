import { useState } from 'react'
import { resetMockData, useMockData, type Group } from '@/lib/mock-data'
import { usePersistentState } from '@/lib/use-persistent-state'
import { GroupEditor } from './GroupEditor'
import { GroupsTab } from './GroupsTab'
import { NoticeBar } from './Notice'
import { RoomsTab } from './RoomsTab'
import { TeachersTab } from './TeachersTab'
import { UnassignedTab } from './UnassignedTab'
import type { Notice } from './shared'

type Tab = 'grupos' | 'profesores' | 'salones' | 'sin-grupo'

/**
 * Grupos y profesores (rediseño). Aquí el director conecta todo:
 * profesores y salones → grupos (nivel, horario, salón, profesor y alumnos) → publicar.
 */
export function GroupsWorkspace() {
  const { groups, teachers, students, rooms } = useMockData()
  const [tab, setTab] = usePersistentState<Tab>('grupos.pestana', 'grupos')
  const [notice, setNotice] = useState<Notice>(null)
  // undefined = panel cerrado; null = grupo nuevo; Group = editar ese grupo.
  const [editing, setEditing] = useState<Group | null | undefined>(undefined)

  const active = students.filter((s) => s.active)
  const unassigned = active.filter((s) => s.groupId === null).length
  const drafts = groups.filter((g) => !g.published).length

  const tabs: [Tab, string, number, boolean?][] = [
    ['grupos', 'Grupos', groups.length],
    ['profesores', 'Profesores', teachers.length],
    ['salones', 'Salones', rooms.length],
    ['sin-grupo', 'Alumnos sin grupo', unassigned, unassigned > 0],
  ]

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl font-black">Grupos y profesores</h1>
        <ol className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
          <li>
            <strong className="text-ink">1.</strong> Crea profesores y salones
          </li>
          <li>
            <strong className="text-ink">2.</strong> Arma cada grupo: nivel, horario, salón, profesor y
            alumnos
          </li>
          <li>
            <strong className="text-ink">3.</strong> Publica para que el profesor lo vea
          </li>
        </ol>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Grupos"
          value={groups.length}
          detail={drafts ? `${drafts} en borrador` : 'Todos publicados'}
        />
        <Stat label="Profesores" value={teachers.length} />
        <Stat
          label="Alumnos con grupo"
          value={active.length - unassigned}
          detail={`de ${active.length} activos`}
        />
        <Stat label="Alumnos sin grupo" value={unassigned} alert={unassigned > 0} />
      </div>

      <NoticeBar notice={notice} />

      <div role="tablist" aria-label="Secciones" className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([key, label, n, alert]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key)
              setNotice(null)
            }}
            className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-bold transition ${
              tab === key ? 'border-brand text-brand' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${alert ? 'bg-warn-soft text-warn' : 'bg-surface text-ink-soft'}`}
            >
              {n}
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'grupos' && <GroupsTab onEdit={setEditing} onNotice={setNotice} />}
        {tab === 'profesores' && <TeachersTab onNotice={setNotice} />}
        {tab === 'salones' && <RoomsTab onNotice={setNotice} />}
        {tab === 'sin-grupo' && <UnassignedTab onNotice={setNotice} />}
      </div>

      <button
        type="button"
        onClick={() => {
          if (
            window.confirm('¿Volver a los datos de ejemplo? Se borra todo lo que creaste en el modo demo.')
          ) {
            resetMockData()
            setNotice({ kind: 'ok', text: 'Se reiniciaron los datos de ejemplo.' })
          }
        }}
        className="self-start text-xs font-semibold text-muted underline underline-offset-2 hover:text-ink"
      >
        Reiniciar datos de ejemplo
      </button>

      {editing !== undefined && (
        <GroupEditor
          key={editing?.id ?? 'nuevo'}
          group={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(text) => {
            setEditing(undefined)
            setTab('grupos')
            setNotice({ kind: 'ok', text })
          }}
        />
      )}
    </section>
  )
}

function Stat({
  label,
  value,
  detail,
  alert,
}: {
  label: string
  value: number
  detail?: string
  alert?: boolean
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 ${alert ? 'border-warn/40' : 'border-line'}`}>
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className={`mt-1 font-display text-3xl font-black tabular-nums ${alert ? 'text-warn' : ''}`}>
        {value}
      </p>
      {detail && <p className="text-xs text-muted">{detail}</p>}
    </div>
  )
}
