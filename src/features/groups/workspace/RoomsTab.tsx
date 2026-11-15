import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { createRoom, deleteRoom, scheduleLabel, useMockData } from '@/lib/mock-data'
import { fieldClass, type Notice } from './shared'

/** Salones de la academia. La plataforma avisa si dos grupos quedan en el mismo salón a la misma hora. */
export function RoomsTab({ onNotice }: { onNotice: (n: Notice) => void }) {
  const { rooms, groups } = useMockData()
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const result = createRoom(name, capacity.trim() ? Number(capacity) : null)
    if (!result.ok) return setError(result.error)
    onNotice({ kind: 'ok', text: `Se creó el ${name.trim()}.` })
    setName('')
    setCapacity('')
    setError(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-5"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-semibold">
          Nombre del salón
          <input
            placeholder="Ej. Salón 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex w-32 flex-col gap-1.5 text-sm font-semibold">
          Cupo (opcional)
          <input
            inputMode="numeric"
            placeholder="Ej. 12"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))}
            className={fieldClass}
          />
        </label>
        <Button type="submit">+ Agregar salón</Button>
        {error && (
          <p
            role="alert"
            className="w-full rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent"
          >
            {error}
          </p>
        )}
      </form>

      {rooms.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-muted">
          Todavía no hay salones. Agrega los de la academia para asignarlos a los grupos.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => {
            const using = groups.filter((g) => g.roomId === r.id)
            return (
              <li key={r.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-lg font-extrabold">{r.name}</p>
                  {r.capacity && (
                    <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold">
                      Cupo {r.capacity}
                    </span>
                  )}
                </div>
                {using.length ? (
                  <ul className="text-sm">
                    {using.map((g) => (
                      <li key={g.id}>
                        <span className="font-semibold">{g.name}</span>{' '}
                        <span className="text-muted">· {scheduleLabel(g)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Libre: ningún grupo lo usa.</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(`¿Eliminar el ${r.name}? Los grupos que lo usan quedarán sin salón.`)
                    ) {
                      deleteRoom(r.id)
                      onNotice({ kind: 'ok', text: `Se eliminó el ${r.name}.` })
                    }
                  }}
                  className="mt-auto self-start text-xs font-semibold text-muted underline underline-offset-2 hover:text-accent"
                >
                  Eliminar
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
