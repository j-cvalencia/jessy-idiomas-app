-- =====================================================================
-- Jessy Idiomas · Fase 1
-- 1. Profesores con usuario (primer nombre + 2 letras de cada apellido) y clave
--    inicial = su documento, que deben cambiar al primer ingreso.
-- 2. Pagos registrados a mano que cubren uno o varios meses, con la fecha hasta
--    la que queda cubierto el estudiante y su estado (al día, próximo a vencer, vencido).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Usuario y cambio obligatorio de clave
-- ---------------------------------------------------------------------
alter table public.profiles
  add column username varchar(40) unique
    check (username ~ '^[a-z]+[0-9]*$'),
  add column must_change_password boolean not null default false;

-- El usuario no puede editar su perfil (no hay política de update); esta función
-- solo apaga su propia marca después de cambiar la clave en Supabase Auth.
create or replace function public.mark_password_changed()
returns void
language sql security definer set search_path = public
as $$ update public.profiles set must_change_password = false where id = auth.uid() $$;

revoke all on function public.mark_password_changed() from public, anon;
grant execute on function public.mark_password_changed() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Pagos por meses
-- `period` pasa a ser el día desde el que cubre el pago (antes: primer día del mes).
-- ---------------------------------------------------------------------
comment on column public.payments.period is 'Día desde el que cubre el pago';

alter table public.payments
  add column months smallint not null default 1 check (months between 1 and 24),
  add column covers_until date generated always as
    ((period + make_interval(months => months::int))::date - 1) stored;

create index payments_student_until on public.payments (student_id, covers_until desc);

-- Días antes del vencimiento en que el estudiante pasa a "próximo a vencer".
create or replace function public.payment_due_soon_days()
returns int language sql immutable as $$ select 7 $$;

-- La vista de estudiantes suma hasta cuándo está cubierto y su estado de pago.
-- (Las columnas existentes se mantienen en el mismo orden; las nuevas van al final.)
create or replace view public.student_overview
with (security_invoker = true) as
select
  s.id,
  s.doc_type,
  s.doc_number,
  s.first_name,
  s.last_name,
  s.phone,
  s.email,
  s.entry_date,
  s.status,
  s.withdrawal_date,
  s.withdrawal_level_id,
  cur.group_id,
  cur.group_name,
  cur.level_id,
  (extract(year from age(coalesce(s.withdrawal_date, current_date), s.entry_date)) * 12
    + extract(month from age(coalesce(s.withdrawal_date, current_date), s.entry_date)))::int
    as months_studied,
  att.attendance_pct,
  coalesce(pay.paid_until >= current_date, false) as paid_this_month,
  pay.paid_until,
  case
    when pay.paid_until is null then 'sin_pago'
    when pay.paid_until < current_date then 'vencido'
    when pay.paid_until - current_date <= public.payment_due_soon_days() then 'por_vencer'
    else 'al_dia'
  end as payment_state
from public.students s
left join lateral (
  select e.group_id, g.name as group_name, g.level_id
  from public.enrollments e
  join public.groups g on g.id = e.group_id
  where e.student_id = s.id and e.end_date is null
  order by e.start_date desc
  limit 1
) cur on true
left join lateral (
  select round(100.0 * count(*) filter (where a.present) / nullif(count(*), 0))::int as attendance_pct
  from public.attendance a
  where a.student_id = s.id
) att on true
left join lateral (
  select max(p.covers_until) as paid_until
  from public.payments p
  where p.student_id = s.id
) pay on true;
