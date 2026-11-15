import { dateLabel, daysLeft, type PaymentState, type Student } from '@/lib/mock-data'

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  al_dia: 'Al día',
  por_vencer: 'Próximo a vencer',
  vencido: 'Vencido',
  sin_pago: 'Sin pagos',
}

/** Detalle corto: "hasta 15 dic 2026", "vence en 3 días", "venció hace 2 días". */
export function paymentDetail(s: Pick<Student, 'paidUntil'>): string {
  const left = daysLeft(s)
  if (left === null || !s.paidUntil) return 'Nunca ha registrado pagos'
  if (left < 0) return `Venció hace ${-left} ${-left === 1 ? 'día' : 'días'}`
  if (left === 0) return 'Vence hoy'
  if (left <= 7) return `Vence en ${left} ${left === 1 ? 'día' : 'días'}`
  return `Cubierto hasta ${dateLabel(s.paidUntil)}`
}
