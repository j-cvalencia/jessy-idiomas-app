// Edge Function: administración de usuarios (solo el director).
// Tarjeta 2.4 en Trello.
//
// POST { action: 'create', doc_type, doc_number, first_name, last_name, role, phone?, guardian_name?, guardian_phone? }
//   → crea el usuario y devuelve un código de activación de 6 dígitos para entregarle a la persona.
// POST { action: 'reset', profile_id }
//   → genera un nuevo código de activación (la persona vuelve a crear su contraseña).
// POST { action: 'create_teacher', doc_number, first_name, last_name, phone?, level_ids: number[] }
//   → crea al profesor con usuario (primer nombre + 2 letras de cada apellido) y clave
//     inicial = su documento, que debe cambiar al primer ingreso. Devuelve el usuario.
// POST { action: 'reset_teacher_password', profile_id }
//   → la clave vuelve a ser su documento y debe cambiarla al entrar.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import {
  baseUsername,
  documentToEmail,
  isValidDocument,
  normalizeDocument,
  randomCode,
  sha256,
  uniqueUsername,
  usernameToEmail,
} from '../_shared/document.ts'

const url = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  // 1. Verificar que quien llama es el director.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: isMaster, error: roleError } = await caller.rpc('is_master')
  if (roleError || !isMaster) return json({ error: 'No autorizado' }, 403)

  const admin = createClient(url, serviceKey)
  const body = await req.json().catch(() => ({}))

  async function issueCode(profileId: string): Promise<string> {
    const code = randomCode()
    const { error } = await admin.from('account_activations').upsert({
      profile_id: profileId,
      code_hash: await sha256(code),
      expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      attempts: 0,
    })
    if (error) throw error
    return code
  }

  try {
    if (body.action === 'create') {
      const doc = normalizeDocument(body.doc_number)
      if (!isValidDocument(doc)) return json({ error: 'Documento inválido' }, 400)
      if (!['master', 'teacher', 'student'].includes(body.role)) return json({ error: 'Rol inválido' }, 400)

      // Contraseña temporal aleatoria: nadie la conoce; la persona crea la suya al activar.
      const tempPassword = crypto.randomUUID() + crypto.randomUUID()
      const { data: created, error: authError } = await admin.auth.admin.createUser({
        email: documentToEmail(doc),
        password: tempPassword,
        email_confirm: true,
      })
      if (authError || !created.user) return json({ error: authError?.message ?? 'No se pudo crear' }, 400)

      const { error: profileError } = await admin.from('profiles').insert({
        id: created.user.id,
        doc_type: body.doc_type ?? 'CC',
        doc_number: doc,
        first_name: body.first_name,
        last_name: body.last_name,
        role: body.role,
        phone: body.phone ?? null,
        guardian_name: body.guardian_name ?? null,
        guardian_phone: body.guardian_phone ?? null,
      })
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id)
        return json({ error: profileError.message }, 400)
      }

      const code = await issueCode(created.user.id)
      return json({ profile_id: created.user.id, activation_code: code })
    }

    if (body.action === 'reset') {
      if (!body.profile_id) return json({ error: 'Falta profile_id' }, 400)
      await admin.from('profiles').update({ is_activated: false }).eq('id', body.profile_id)
      const code = await issueCode(body.profile_id)
      return json({ activation_code: code })
    }

    if (body.action === 'create_teacher') {
      const doc = normalizeDocument(body.doc_number)
      if (!isValidDocument(doc)) return json({ error: 'Documento inválido' }, 400)
      const levels: number[] = Array.isArray(body.level_ids) ? body.level_ids.map(Number) : []
      if (levels.length === 0) return json({ error: 'Elige al menos un nivel' }, 400)

      const base = baseUsername(body.first_name, body.last_name)
      if (!base) return json({ error: 'Revisa el nombre del profesor' }, 400)
      const { data: similar, error: lookupError } = await admin
        .from('profiles')
        .select('username')
        .like('username', `${base}%`)
      if (lookupError) throw lookupError
      const username = uniqueUsername(
        base,
        (similar ?? []).map((r) => r.username as string),
      )

      const { data: created, error: authError } = await admin.auth.admin.createUser({
        email: usernameToEmail(username),
        password: doc, // clave inicial: su documento (debe cambiarla al entrar)
        email_confirm: true,
      })
      if (authError || !created.user) return json({ error: authError?.message ?? 'No se pudo crear' }, 400)

      const { error: profileError } = await admin.from('profiles').insert({
        id: created.user.id,
        doc_type: 'CC',
        doc_number: doc,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone ?? null,
        role: 'teacher',
        username,
        is_activated: true,
        must_change_password: true,
      })
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id)
        return json({ error: profileError.message }, 400)
      }

      const { error: levelsError } = await admin
        .from('teacher_levels')
        .insert(levels.map((level_id) => ({ teacher_id: created.user.id, level_id })))
      if (levelsError) throw levelsError

      return json({ profile_id: created.user.id, username })
    }

    if (body.action === 'reset_teacher_password') {
      const { data: teacher, error } = await admin
        .from('profiles')
        .select('id, doc_number, role')
        .eq('id', body.profile_id)
        .single()
      if (error || teacher?.role !== 'teacher') return json({ error: 'Profesor no encontrado' }, 404)
      const { error: authError } = await admin.auth.admin.updateUserById(teacher.id, {
        password: teacher.doc_number,
      })
      if (authError) throw authError
      await admin.from('profiles').update({ must_change_password: true }).eq('id', teacher.id)
      return json({ ok: true })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: 'Error interno' }, 500)
  }
})
