import { paymentState, type PaymentState, type Student } from '@/lib/mock-data'
import { PAYMENT_STATE_LABEL, paymentDetail } from './payment-text'

const STYLE: Record<PaymentState, string> = {
  al_dia: 'bg-ok-soft text-ok',
  por_vencer: 'bg-warn-soft text-warn',
  vencido: 'bg-accent-soft text-accent',
  sin_pago: 'bg-surface text-muted',
}

export function PaymentBadge({ student, withDetail = false }: { student: Student; withDetail?: boolean }) {
  const state = paymentState(student)
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${STYLE[state]}`}>
        {PAYMENT_STATE_LABEL[state]}
      </span>
      {withDetail && <span className="text-xs text-muted">{paymentDetail(student)}</span>}
    </span>
  )
}
