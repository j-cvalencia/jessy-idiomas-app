import { describe, expect, it } from 'vitest'
import { addMonths, coverageUntil, nextPaymentStart, paymentState } from './mock-data'

describe('cálculo de pagos', () => {
  it('un mes desde el 1 cubre hasta el último día del mes', () => {
    expect(coverageUntil('2026-12-01', 1)).toBe('2026-12-31')
    expect(coverageUntil('2026-12-01', 3)).toBe('2027-02-28')
  })

  it('un mes desde el 15 cubre hasta el 14 del mes siguiente', () => {
    expect(coverageUntil('2026-11-15', 1)).toBe('2026-12-14')
  })

  it('respeta los meses cortos', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
  })

  it('clasifica el estado según los días que faltan', () => {
    const hoy = '2026-11-15'
    expect(paymentState({ paidUntil: null }, hoy)).toBe('sin_pago')
    expect(paymentState({ paidUntil: '2026-11-14' }, hoy)).toBe('vencido')
    expect(paymentState({ paidUntil: '2026-11-15' }, hoy)).toBe('por_vencer')
    expect(paymentState({ paidUntil: '2026-11-22' }, hoy)).toBe('por_vencer')
    expect(paymentState({ paidUntil: '2026-11-23' }, hoy)).toBe('al_dia')
  })

  it('el siguiente pago sigue al anterior, o empieza hoy si estaba vencido', () => {
    const hoy = '2026-11-15'
    expect(nextPaymentStart({ paidUntil: '2026-11-30' }, hoy)).toBe('2026-12-01')
    expect(nextPaymentStart({ paidUntil: '2026-11-01' }, hoy)).toBe(hoy)
    expect(nextPaymentStart({ paidUntil: null }, hoy)).toBe(hoy)
  })
})
