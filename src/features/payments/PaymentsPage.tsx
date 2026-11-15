import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import {
  coverageUntil,
  dateLabel,
  daysLeft,
  deletePayment,
  fullName,
  groupById,
  nextPaymentStart,
  paymentState,
  registerPayment,
  useMockData,
  type PaymentMethod,
  type PaymentState,
  type Student,
} from '@/lib/mock-data'
import { usePersistentState } from '@/lib/use-persistent-state'
import { PaymentBadge } from './PaymentBadge'
import { paymentDetail } from './payment-text'

// Tarjeta 3.4: pagos registrados a mano por el director. La plataforma calcula hasta
// cuándo está cubierto cada estudiante y avisa quién está próximo a vencer.

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const money = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

const METHODS: [PaymentMethod, string][] = [
  ['nequi', 'Nequi'],
  ['transferencia', 'Transferencia'],
  ['efectivo', 'Efectivo'],
  ['otro', 'Otro'],
]

type Filter = 'todos' | PaymentState

// Primero lo urgente: vencidos y sin pago, luego los próximos a vencer, luego al día.
const URGENCY: Record<PaymentState, number> = { vencido: 0, sin_pago: 1, por_vencer: 2, al_dia: 3 }

const fieldClass =
  'min-h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

export function PaymentsPage() {
  const { students, payments } = useMockData()
  const [filter, setFilter] = usePersistentState<Filter>('pagos.filtro', 'todos')
  const [query, setQuery] = usePersistentState('pagos.busqueda', '')
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const active = students.filter((s) => s.active)
  const counts = useMemo(() => {
    const c: Record<PaymentState, number> = { al_dia: 0, por_vencer: 0, vencido: 0, sin_pago: 0 }
    active.forEach((s) => c[paymentState(s)]++)
    return c
  }, [active])

  const list = useMemo(() => {
    const q = normalize(query.trim())
    return active
      .filter((s) => filter === 'todos' || paymentState(s) === filter)
      .filter((s) => !q || normalize(fullName(s)).includes(q) || s.docNumber.endsWith(q))
      .sort(
        (a, b) =>
          URGENCY[paymentState(a)] - URGENCY[paymentState(b)] ||
          (daysLeft(a) ?? -9999) - (daysLeft(b) ?? -9999),
      )
  }, [active, filter, query])

  const tabs: [Filter, string, number][] = [
    ['todos', 'Todos', active.length],
    ['por_vencer', 'Próximos a vencer', counts.por_vencer],
    ['vencido', 'Vencidos', counts.vencido],
    ['sin_pago', 'Sin pagos', counts.sin_pago],
    ['al_dia', 'Al día', counts.al_dia],
  ]

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl font-black">Pagos</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Registra los pagos a mano. La plataforma calcula hasta cuándo está cubierto cada estudiante.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Al día" value={counts.al_dia} tone="ok" />
        <Stat label="Próximos a vencer (7 días)" value={counts.por_vencer} tone="warn" />
        <Stat label="Vencidos o sin pagos" value={counts.vencido + counts.sin_pago} tone="accent" />
      </div>

      {notice && (
        <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div role="tablist" aria-label="Filtrar por estado de pago" className="flex flex-wrap gap-2">
          {tabs.map(([key, label, n]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`min-h-11 rounded-full border px-4 text-sm font-bold transition ${
                filter === key ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:bg-surface'
              }`}
            >
              {label} <span className="ml-1 opacity-70">{n}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o últimos dígitos del documento"
          aria-label="Buscar estudiante"
          className={`${fieldClass} w-full max-w-md`}
        />
      </div>

      <ul className="flex flex-col gap-3">
        {list.map((s) => (
          <li key={s.id} className="rounded-2xl border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-48">
                <p className="font-semibold">{fullName(s)}</p>
                <p className="text-xs text-muted">{groupById(s.groupId)?.name ?? 'Sin grupo'}</p>
              </div>
              <div className="flex items-center gap-4">
                <PaymentBadge student={s} withDetail />
                <Button
                  variant={openId === s.id ? 'secondary' : 'primary'}
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                >
                  {openId === s.id ? 'Cerrar' : 'Registrar pago'}
                </Button>
              </div>
            </div>
            {openId === s.id && (
              <PaymentForm
                student={s}
                onDone={(text) => {
                  setOpenId(null)
                  setNotice(text)
                }}
              />
            )}
          </li>
        ))}
        {list.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
            No hay estudiantes con ese filtro.
          </li>
        )}
      </ul>

      <div className="rounded-2xl border border-line bg-white">
        <h2 className="px-5 py-4 font-display text-xl font-extrabold">Últimos pagos registrados</h2>
        {payments.length === 0 ? (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">
            Todavía no se ha registrado ningún pago.
          </p>
        ) : (
          <ul>
            {payments.slice(0, 15).map((p) => {
              const st = students.find((x) => x.id === p.studentId)
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm"
                >
                  <span>
                    <span className="font-semibold">{st ? fullName(st) : 'Estudiante eliminado'}</span>
                    <span className="text-muted">
                      {' '}
                      · {p.months} {p.months === 1 ? 'mes' : 'meses'} · {dateLabel(p.from)} a{' '}
                      {dateLabel(p.until)}
                    </span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-semibold tabular-nums">{money(p.amount)}</span>
                    <span className="text-muted">{METHODS.find((m) => m[0] === p.method)?.[1]}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('¿Borrar este pago? Úsalo solo si se registró por error.')) {
                          deletePayment(p.id)
                          setNotice('Se borró el pago.')
                        }
                      }}
                      className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-accent"
                    >
                      Borrar
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'accent' }) {
  const color = { ok: 'text-ok', warn: 'text-warn', accent: 'text-accent' }[tone]
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className={`mt-1 font-display text-3xl font-black tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function PaymentForm({ student, onDone }: { student: Student; onDone: (text: string) => void }) {
  const [months, setMonths] = useState(1)
  const [from, setFrom] = useState(() => nextPaymentStart(student))
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('nequi')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const until = from ? coverageUntil(from, months) : null

  function submit(e: FormEvent) {
    e.preventDefault()
    const result = registerPayment({
      studentId: student.id,
      months,
      from,
      amount: Number(amount.replace(/\D/g, '')),
      method,
      notes,
    })
    if (!result.ok) return setError(result.error)
    onDone(`Pago registrado: ${fullName(student)} queda cubierto hasta ${dateLabel(until!)}.`)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border-t border-line bg-surface p-4">
      <p className="text-sm text-ink-soft">Estado actual: {paymentDetail(student)}.</p>

      <fieldset>
        <legend className="text-sm font-semibold">¿Cuántos meses pagó?</legend>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {[1, 2, 3, 6].map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={months === m}
              onClick={() => setMonths(m)}
              className={`min-h-11 min-w-12 rounded-lg border px-3 text-sm font-extrabold ${
                months === m ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:bg-surface'
              }`}
            >
              {m}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm">
            Otro:
            <input
              type="number"
              min={1}
              max={24}
              value={months}
              onChange={(e) => setMonths(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
              className={`${fieldClass} w-20`}
            />
          </label>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Valor pagado
          <input
            inputMode="numeric"
            placeholder="Ej. 200000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Medio
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className={fieldClass}
          >
            {METHODS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Nota (opcional)
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} />
      </label>

      {until && (
        <p className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-line">
          Queda cubierto del <strong>{dateLabel(from)}</strong> al <strong>{dateLabel(until)}</strong>.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      <div>
        <Button type="submit">Guardar pago</Button>
      </div>
    </form>
  )
}
