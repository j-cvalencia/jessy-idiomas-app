import { describe, expect, it } from 'vitest'
import {
  checkTeacherLogin,
  createRoom,
  createTeacher,
  getMockState,
  groupById,
  publishGroup,
  saveGroup,
  type GroupDraft,
} from './mock-data'

describe('guardar un grupo completo', () => {
  createRoom('Salón Prueba', 2)
  createTeacher({
    firstName: 'Ana',
    lastName: 'Ríos Paz',
    phone: '3000000000',
    docNumber: '1000000001',
    levels: ['A1'],
  })
  const teacherId = checkTeacherLogin('anaripa', '1000000001')!.id
  const roomId = getMockState().rooms.find((r) => r.name === 'Salón Prueba')!.id
  const [s1, s2, s3] = getMockState().students.filter((s) => s.active && s.groupId === null)

  const base: GroupDraft = {
    name: 'A1 Noche',
    level: 'A1',
    days: ['Lun', 'Mié'],
    time: '18:00',
    endTime: '19:30',
    roomId,
    teacherId,
    studentIds: [s1.id, s2.id],
  }

  let firstId = ''

  it('crea el grupo como borrador con sus alumnos y luego se publica', () => {
    const r = saveGroup(null, base)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    firstId = r.id
    expect(groupById(r.id)?.published).toBe(false)
    expect(getMockState().students.find((s) => s.id === s1.id)?.groupId).toBe(r.id)
    expect(publishGroup(r.id).ok).toBe(true)
    expect(groupById(r.id)?.published).toBe(true)
  })

  it('no deja usar el mismo salón a la misma hora', () => {
    const r = saveGroup(null, {
      ...base,
      name: 'Otro',
      teacherId: null,
      studentIds: [],
      time: '19:00',
      endTime: '20:00',
    })
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.error).toContain('ocupado')
  })

  it('no deja al profesor en dos grupos a la misma hora', () => {
    const r = saveGroup(null, {
      ...base,
      name: 'Otro',
      roomId: null,
      studentIds: [],
      time: '19:00',
      endTime: '20:00',
    })
    expect(r).toMatchObject({ ok: false })
  })

  it('respeta el cupo del salón y si falla no cambia nada', () => {
    const r = saveGroup(firstId, { ...base, studentIds: [s1.id, s2.id, s3.id] })
    expect(r).toMatchObject({ ok: false })
    expect(getMockState().students.find((s) => s.id === s3.id)?.groupId).toBeNull()
  })

  it('al quitar un alumno en la edición, queda sin grupo', () => {
    const r = saveGroup(firstId, { ...base, studentIds: [s1.id] })
    expect(r.ok).toBe(true)
    expect(getMockState().students.find((s) => s.id === s2.id)?.groupId).toBeNull()
  })

  it('no publica un grupo sin profesor', () => {
    const r = saveGroup(null, {
      ...base,
      name: 'Sin profe',
      teacherId: null,
      roomId: null,
      studentIds: [],
      days: ['Vie'],
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(publishGroup(r.id).ok).toBe(false)
  })
})
