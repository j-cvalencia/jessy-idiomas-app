import { describe, expect, it } from 'vitest'
import { baseUsername, isUsername, loginToEmail, uniqueUsername } from './username'

describe('usuario del profesor', () => {
  it('primer nombre + 2 letras de cada apellido, sin tildes', () => {
    expect(baseUsername('Laura Andrea', 'Smith Gómez')).toBe('laurasmgo')
    expect(baseUsername('Ángela', 'Muñoz Ñañez')).toBe('angelamuna')
  })

  it('con un solo apellido usa solo ese', () => {
    expect(baseUsername('Laura', 'Smith')).toBe('laurasm')
  })

  it('agrega un número si ya existe', () => {
    expect(uniqueUsername('laurasmgo', [])).toBe('laurasmgo')
    expect(uniqueUsername('laurasmgo', ['laurasmgo'])).toBe('laurasmgo2')
    expect(uniqueUsername('laurasmgo', ['laurasmgo', 'laurasmgo2'])).toBe('laurasmgo3')
  })

  it('distingue usuario de documento', () => {
    expect(isUsername('LauraSmGo')).toBe(true)
    expect(isUsername('1036003768')).toBe(false)
  })

  it('convierte usuario o documento en el correo interno', () => {
    expect(loginToEmail('laurasmgo')).toBe('laurasmgo@usuarios.jessyidiomas.app')
    expect(loginToEmail('1.036.003.768')).toBe('1036003768@usuarios.jessyidiomas.app')
    expect(() => loginToEmail('12')).toThrow()
  })
})
