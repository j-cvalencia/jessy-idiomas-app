import { describe, expect, it } from 'vitest'
import {
  checkTeacherLogin,
  createStudent,
  createTeacher,
  getMockState,
  saveGroup,
  updateStudent,
  updateTeacher,
} from './mock-data'

describe('editar profesores y estudiantes', () => {
  createTeacher({
    firstName: 'Ana',
    lastName: 'Ríos Paz',
    phone: '3000000000',
    docNumber: '1000000001',
    levels: ['A1'],
  })
  const ana = checkTeacherLogin('anaripa', '1000000001')!

  it('actualiza los datos del profesor sin cambiar su usuario', () => {
    const r = updateTeacher(ana.id, { ...ana, phone: '3119998877', levels: ['A1', 'B1'] })
    expect(r.ok).toBe(true)
    const t = getMockState().teachers.find((x) => x.id === ana.id)!
    expect(t.phone).toBe('3119998877')
    expect(t.username).toBe('anaripa')
  })

  it('si cambia el documento antes de su primer ingreso, la clave inicial es el documento nuevo', () => {
    updateTeacher(ana.id, { ...ana, docNumber: '1000000002', levels: ['A1'] })
    expect(checkTeacherLogin('anaripa', '1000000002')).not.toBeNull()
  })

  it('no deja quitarle al profesor el nivel de un grupo que dicta', () => {
    const g = saveGroup(null, {
      name: 'A1 Prueba',
      level: 'A1',
      days: ['Sáb'],
      time: '08:00',
      endTime: '10:00',
      roomId: null,
      teacherId: ana.id,
      studentIds: [],
    })
    expect(g.ok).toBe(true)
    const r = updateTeacher(ana.id, { ...ana, docNumber: '1000000002', levels: ['B1'] })
    expect(r).toMatchObject({ ok: false })
  })

  it('registra y edita un estudiante; los menores necesitan acudiente', () => {
    const base = {
      firstName: 'Tomás',
      lastName: 'Gil',
      docType: 'TI' as const,
      docNumber: '1100000001',
      phone: '3005550000',
      email: '',
      guardianName: '',
      guardianPhone: '',
      active: true,
    }
    expect(createStudent(base)).toMatchObject({ ok: false })
    expect(createStudent({ ...base, guardianName: 'Marta Gil', guardianPhone: '3005551111' }).ok).toBe(true)
    const st = getMockState().students.find((s) => s.docNumber === '1100000001')!
    expect(updateStudent(st.id, { ...base, guardianName: 'Marta Gil', email: 'malo' })).toMatchObject({
      ok: false,
    })
    expect(updateStudent(st.id, { ...base, guardianName: 'Marta Gil', email: 'tomas@correo.com' }).ok).toBe(
      true,
    )
    expect(getMockState().students.find((s) => s.id === st.id)?.email).toBe('tomas@correo.com')
  })

  it('al marcar inactivo, el estudiante sale de su grupo', () => {
    const st = getMockState().students.find((s) => s.active && s.groupId === null)!
    saveGroup(null, {
      name: 'B1 Prueba',
      level: 'B1',
      days: ['Dom'],
      time: '08:00',
      endTime: '09:00',
      roomId: null,
      teacherId: null,
      studentIds: [st.id],
    })
    updateStudent(st.id, { ...st, active: false })
    expect(getMockState().students.find((s) => s.id === st.id)?.groupId).toBeNull()
  })
})
