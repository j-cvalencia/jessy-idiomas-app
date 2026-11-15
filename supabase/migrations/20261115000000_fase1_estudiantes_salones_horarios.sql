-- =====================================================================
-- Jessy Idiomas · Fase 1 (director y profesor)
--
-- 1. Estudiantes sin cuenta de acceso: el director registra a cada estudiante
--    sin crearle usuario. En la Fase 2, al activarle la cuenta, se enlaza con
--    `students.profile_id`. `profiles` queda para quien inicia sesión.
-- 2. Ficha completa del estudiante: fecha de ingreso, estado y datos de retiro
--    (para los recordatorios a exalumnos de la Fase 2).
-- 3. Salones y horarios por grupo (día, hora de inicio, hora de salida, salón),
--    con aviso si un salón o un profesor ya está ocupado a esa hora.
-- 4. Niveles que puede enseñar cada profesor.
-- 5. Vista `student_overview` con grupo actual, meses estudiados, asistencia
--    y estado de pago del mes, para la pantalla de Estudiantes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 y 2. Estudiantes
-- ---------------------------------------------------------------------
create type public.student_status as enum ('active', 'withdrawn');

create table public.students (
  id                   uuid primary key default gen_random_uuid(),
  -- Cuenta de acceso (Fase 2). Vacío mientras el estudiante no inicie sesión.
  profile_id           uuid unique references public.profiles (id) on delete set null,
  doc_type             public.doc_type not null default 'CC',
  doc_number           varchar(15) not null unique,
  first_name           varchar(80) not null,
  last_name            varchar(80) not null,
  birth_date           date,
  phone                varchar(20),
  email                varchar(120),
  guardian_name        varchar(120),
  guardian_phone       varchar(20),
  entry_date           date not null default current_date,
  status               public.student_status not null default 'active',
  withdrawal_date      date,
  withdrawal_level_id  smallint references public.levels (id),
  withdrawal_reason    text,
  notes                text,
  -- Ley 1581: autorización de tratamiento de datos y, aparte, de recibir mensajes.
  data_consent_at      timestamptz,
  marketing_consent    boolean not null default false,
  created_at           timestamptz not null default now(),
  constraint students_withdrawal_has_date
    check (status = 'active' or withdrawal_date is not null),
  constraint students_withdrawal_after_entry
    check (withdrawal_date is null or withdrawal_date >= entry_date)
);
create index students_status on public.students (status);

-- Si ya existían estudiantes como perfiles, se copian con el mismo id para que
-- matrículas, pagos, asistencia, etc. sigan apuntando al mismo estudiante.
insert into public.students (
  id, profile_id, doc_type, doc_number, first_name, last_name, birth_date,
  phone, email, guardian_name, guardian_phone, entry_date, status,
  withdrawal_date, data_consent_at
)
select
  p.id, p.id, p.doc_type, p.doc_number, p.first_name, p.last_name, p.birth_date,
  p.phone, p.email, p.guardian_name, p.guardian_phone, p.created_at::date,
  case when p.active then 'active' else 'withdrawn' end::public.student_status,
  case when p.active then null else current_date end,
  p.data_consent_at
from public.profiles p
where p.role = 'student';

-- Todo lo que era "del estudiante" ahora apunta a `students`.
alter table public.enrollments
  drop constraint enrollments_student_id_fkey,
  add constraint enrollments_student_id_fkey
    foreign key (student_id) references public.students (id) on delete cascade;
alter table public.attendance
  drop constraint attendance_student_id_fkey,
  add constraint attendance_student_id_fkey
    foreign key (student_id) references public.students (id) on delete cascade;
alter table public.payments
  drop constraint payments_student_id_fkey,
  add constraint payments_student_id_fkey
    foreign key (student_id) references public.students (id) on delete cascade;
alter table public.exam_results
  drop constraint exam_results_student_id_fkey,
  add constraint exam_results_student_id_fkey
    foreign key (student_id) references public.students (id) on delete cascade;
alter table public.exercise_attempts
  drop constraint exercise_attempts_student_id_fkey,
  add constraint exercise_attempts_student_id_fkey
    foreign key (student_id) references public.students (id) on delete cascade;

-- Estudiante enlazado con el usuario que inició sesión (Fase 2). Null para director y profesores.
create or replace function public.current_student_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.students where profile_id = auth.uid() $$;

-- ---------------------------------------------------------------------
-- 3. Salones y horarios
-- ---------------------------------------------------------------------
create table public.rooms (
  id        uuid primary key default gen_random_uuid(),
  name      varchar(40) not null unique,
  capacity  smallint check (capacity > 0),
  active    boolean not null default true
);

-- Un grupo puede tener varias franjas: p. ej. lunes y miércoles de 6:00 a 7:30 pm.
create table public.group_schedules (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7), -- 1 = lunes … 7 = domingo
  start_time  time not null,
  end_time    time not null,
  room_id     uuid references public.rooms (id) on delete set null,
  constraint group_schedules_valid_hours check (end_time > start_time)
);
create index group_schedules_group on public.group_schedules (group_id);
create index group_schedules_room_day on public.group_schedules (room_id, weekday);

-- El horario en texto libre queda reemplazado por group_schedules.
alter table public.groups drop column schedule;

-- ---------------------------------------------------------------------
-- 4. Niveles que enseña cada profesor
-- ---------------------------------------------------------------------
create table public.teacher_levels (
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  level_id    smallint not null references public.levels (id),
  primary key (teacher_id, level_id)
);

-- ---------------------------------------------------------------------
-- Reglas de horario (mensajes en español para mostrarlos tal cual en pantalla)
-- ---------------------------------------------------------------------
create or replace function public.weekday_name(d smallint)
returns text language sql immutable
as $$ select (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[d] $$;

-- Al crear o cambiar una franja: el salón y el profesor no pueden estar ocupados.
create or replace function public.check_schedule_conflicts()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  clash record;
  v_teacher uuid;
begin
  if new.room_id is not null then
    select g.name, r.name as room into clash
    from public.group_schedules s
    join public.groups g on g.id = s.group_id and g.active
    join public.rooms r on r.id = s.room_id
    where s.room_id = new.room_id
      and s.weekday = new.weekday
      and s.id <> new.id
      and s.start_time < new.end_time
      and new.start_time < s.end_time
    limit 1;
    if found then
      raise exception 'El salón % ya está ocupado el % a esa hora por el grupo %.',
        clash.room, public.weekday_name(new.weekday), clash.name
        using errcode = 'P0001';
    end if;
  end if;

  select teacher_id into v_teacher from public.groups where id = new.group_id;
  if v_teacher is not null then
    select g.name into clash
    from public.group_schedules s
    join public.groups g on g.id = s.group_id and g.active
    where g.teacher_id = v_teacher
      and s.group_id <> new.group_id
      and s.weekday = new.weekday
      and s.start_time < new.end_time
      and new.start_time < s.end_time
    limit 1;
    if found then
      raise exception 'El profesor ya tiene el grupo % el % a esa hora.',
        clash.name, public.weekday_name(new.weekday)
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

create trigger group_schedules_conflicts
  before insert or update on public.group_schedules
  for each row execute function public.check_schedule_conflicts();

-- Al asignar profesor a un grupo: debe enseñar ese nivel y no tener otro grupo a la misma hora.
create or replace function public.check_group_teacher()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  clash record;
begin
  if new.teacher_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.teacher_levels tl
    where tl.teacher_id = new.teacher_id and tl.level_id = new.level_id
  ) then
    raise exception 'Ese profesor no tiene asignado el nivel de este grupo.'
      using errcode = 'P0001';
  end if;

  select g2.name, s1.weekday into clash
  from public.group_schedules s1
  join public.group_schedules s2
    on s2.weekday = s1.weekday
   and s2.start_time < s1.end_time
   and s1.start_time < s2.end_time
  join public.groups g2 on g2.id = s2.group_id and g2.active
  where s1.group_id = new.id
    and g2.id <> new.id
    and g2.teacher_id = new.teacher_id
  limit 1;
  if found then
    raise exception 'El profesor ya tiene el grupo % el % a esa hora.',
      clash.name, public.weekday_name(clash.weekday)
      using errcode = 'P0001';
  end if;

  return new;
end $$;

create trigger groups_teacher_rules
  before insert or update of teacher_id, level_id on public.groups
  for each row execute function public.check_group_teacher();

-- ---------------------------------------------------------------------
-- 5. Vista para la pantalla de Estudiantes
--    security_invoker: respeta las políticas RLS de quien la consulta.
-- ---------------------------------------------------------------------
create view public.student_overview
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
  exists (
    select 1 from public.payments p
    where p.student_id = s.id
      and p.period = date_trunc('month', current_date)::date
  ) as paid_this_month
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
) att on true;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.students        enable row level security;
alter table public.rooms           enable row level security;
alter table public.group_schedules enable row level security;
alter table public.teacher_levels  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['students', 'rooms', 'group_schedules', 'teacher_levels'] loop
    execute format(
      'create policy "master_all" on public.%I for all to authenticated using (public.is_master()) with check (public.is_master())',
      t);
  end loop;
end $$;

-- Estudiantes: el profesor ve a los de sus grupos; el estudiante (Fase 2) se ve a sí mismo.
create policy "teacher_reads_students" on public.students for select to authenticated
  using (public.current_user_role() = 'teacher' and public.teaches_student(id));
create policy "student_self" on public.students for select to authenticated
  using (profile_id = auth.uid());

-- Los estudiantes ya no viven en profiles: el profesor no necesita leer perfiles ajenos.
drop policy "teacher_reads_students" on public.profiles;

-- Salones: cualquier usuario autenticado los ve (para mostrar dónde es la clase).
create policy "read_rooms" on public.rooms for select to authenticated using (true);

-- Horarios: el profesor ve los de sus grupos; el estudiante los de su grupo.
create policy "teacher_schedules" on public.group_schedules for select to authenticated
  using (public.teaches_group(group_id));
create policy "student_schedules" on public.group_schedules for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.group_id = group_schedules.group_id and e.student_id = public.current_student_id()
  ));

-- Niveles del profesor: cada profesor ve los suyos.
create policy "teacher_own_levels" on public.teacher_levels for select to authenticated
  using (teacher_id = auth.uid());

-- Políticas del estudiante: antes comparaban con auth.uid(); ahora con su ficha.
drop policy "student_groups" on public.groups;
create policy "student_groups" on public.groups for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.group_id = groups.id and e.student_id = public.current_student_id()
  ));

drop policy "student_own_enrollments" on public.enrollments;
create policy "student_own_enrollments" on public.enrollments for select to authenticated
  using (student_id = public.current_student_id());

drop policy "student_sessions" on public.class_sessions;
create policy "student_sessions" on public.class_sessions for select to authenticated
  using (
    status in ('published', 'done')
    and exists (
      select 1 from public.enrollments e
      where e.group_id = class_sessions.group_id and e.student_id = public.current_student_id()
    )
  );

drop policy "student_own_attendance" on public.attendance;
create policy "student_own_attendance" on public.attendance for select to authenticated
  using (student_id = public.current_student_id());

drop policy "student_own_payments" on public.payments;
create policy "student_own_payments" on public.payments for select to authenticated
  using (student_id = public.current_student_id());

drop policy "student_own_exams" on public.exam_results;
create policy "student_own_exams" on public.exam_results for select to authenticated
  using (student_id = public.current_student_id());

drop policy "student_insert_attempts" on public.exercise_attempts;
create policy "student_insert_attempts" on public.exercise_attempts for insert to authenticated
  with check (student_id = public.current_student_id());

drop policy "student_read_attempts" on public.exercise_attempts;
create policy "student_read_attempts" on public.exercise_attempts for select to authenticated
  using (student_id = public.current_student_id());
