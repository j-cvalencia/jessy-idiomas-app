import { useState } from 'react'
import { maskDocument } from '@/lib/document'
import { assignStudent, fullName, useMockData } from '@/lib/mock-data'
import { fieldClass, matches, type Notice } from './shared'

/** Alumnos activos que todavía no tienen grupo, con atajo para asignarlos. */
export function UnassignedTab({ onNotice }: { onNotice: (n: Notice) => void }) {
  const { students, groups } = useMockData()
  const [search, setSearch] = useState('')
  const pending = students.filter((s) => s.active && s.groupId === null)
  const list = pending.filter((s) => matches(s, search))

  if (pending.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center font-semibold text-ok">
        Todos los alumnos activos tienen grupo.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        placeholder="Buscar por nombre o últimos dígitos del documento"
        aria-label="Buscar alumno sin grupo"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${fieldClass} max-w-md`}
      />
      <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
        {list.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span>
              <span className="font-semibold">{fullName(s)}</span>{' '}
              <span className="text-xs text-muted">
                {s.docType} {maskDocument(s.docNumber)}
              </span>
            </span>
            <select
              aria-label={`Asignar a ${fullName(s)} a un grupo`}
              value=""
              disabled={groups.length === 0}
              onChange={(e) => {
                const g = groups.find((x) => x.id === e.target.value)
                if (!g) return
                const r = assignStudent(s.id, g.id)
                onNotice(
                  r.ok
                    ? { kind: 'ok', text: `${fullName(s)} quedó en ${g.name}.` }
                    : { kind: 'error', text: r.error },
                )
              }}
              className={`${fieldClass} w-auto min-w-52`}
            >
              <option value="">{groups.length ? 'Asignar a grupo…' : 'Primero crea un grupo'}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.level} · {g.name}
                </option>
              ))}
            </select>
          </li>
        ))}
        {list.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Sin resultados.</li>}
      </ul>
    </div>
  )
}
