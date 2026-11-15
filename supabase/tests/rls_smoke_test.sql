-- Prueba de las reglas de horario y de las políticas RLS (seguridad por rol).
-- Ejecutar sobre una base LOCAL ya migrada (npx supabase db reset) con:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls_smoke_test.sql
-- Todo corre dentro de una transacción que se deshace al final: no deja datos.
-- Cada verificación imprime "OK: …". Si algo no cumple, se detiene con "FALLO: …".

\set ON_ERROR_STOP on
begin;

-- ---------------------------------------------------------------------
-- Datos de prueba
-- ---------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email) values
 ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','d@x.test'),
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t1@x.test'),
 ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t2@x.test'),
 ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t3@x.test'),
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s1@x.test');

insert into profiles (id, doc_number, first_name, last_name, role) values
 ('00000000-0000-0000-0000-00000000000a', '100001', 'Jessy',  'D', 'master'),
 ('00000000-0000-0000-0000-0000000000a1', '100011', 'Laura',  'P', 'teacher'),
 ('00000000-0000-0000-0000-0000000000a2', '100012', 'Andrés', 'P', 'teacher'),
 ('00000000-0000-0000-0000-0000000000a3', '100013', 'Nuevo',  'P', 'teacher'),
 ('00000000-0000-0000-0000-0000000000c1', '100031', 'Sara',   'E', 'student'); -- cuenta de Fase 2

insert into teacher_levels (teacher_id, level_id) values
 ('00000000-0000-0000-0000-0000000000a1', 1),
 ('00000000-0000-0000-0000-0000000000a2', 1),
 ('00000000-0000-0000-0000-0000000000a2', 2);

insert into rooms (id, name, capacity) values
 ('50000000-0000-0000-0000-000000000001', 'Salón 1', 12),
 ('50000000-0000-0000-0000-000000000002', 'Salón 2', 10);

insert into groups (id, name, level_id, teacher_id) values
 ('30000000-0000-0000-0000-000000000001', 'A1 Lunes noche', 1, '00000000-0000-0000-0000-0000000000a1'),
 ('30000000-0000-0000-0000-000000000002', 'A2 Lunes noche', 2, '00000000-0000-0000-0000-0000000000a2');

insert into group_schedules (group_id, weekday, start_time, end_time, room_id) values
 ('30000000-0000-0000-0000-000000000001', 1, '18:00', '19:30', '50000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002', 1, '18:00', '19:30', '50000000-0000-0000-0000-000000000002');

-- Dos estudiantes SIN cuenta (Fase 1) y uno enlazado a una cuenta (Fase 2).
insert into students (id, doc_number, first_name, last_name, entry_date, profile_id) values
 ('60000000-0000-0000-0000-000000000001', '200001', 'Valentina', 'O', current_date - 400, null),
 ('60000000-0000-0000-0000-000000000002', '200002', 'Samuel',    'R', current_date - 30,  null),
 ('60000000-0000-0000-0000-000000000003', '200003', 'Sara',      'E', current_date - 90,  '00000000-0000-0000-0000-0000000000c1');

insert into enrollments (student_id, group_id) values
 ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
 ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002'),
 ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001');

insert into modules (id, level_id, number, title) values ('10000000-0000-0000-0000-000000000001', 1, 99, 'M');
insert into lessons (id, module_id, number, title, topic, sort_order)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'C1', 'verb to be', 1);

insert into class_sessions (id, group_id, lesson_id, scheduled_date, status) values
 ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', current_date, 'published'),
 ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', current_date + 2, 'draft'),
 ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', current_date, 'published');

insert into payments (student_id, amount, period, method) values
 ('60000000-0000-0000-0000-000000000001', 200000, date_trunc('month', current_date), 'nequi');

-- ---------------------------------------------------------------------
-- Reglas de horario (como director / base de datos)
-- ---------------------------------------------------------------------
do $$ begin
  insert into group_schedules (group_id, weekday, start_time, end_time, room_id)
    values ('30000000-0000-0000-0000-000000000002', 1, '19:00', '20:00', '50000000-0000-0000-0000-000000000001');
  raise exception 'FALLO: permitió usar un salón ocupado';
exception when others then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK salón ocupado → %', sqlerrm;
end $$;

do $$ begin
  -- Empieza justo cuando termina la otra clase: sí se permite.
  insert into group_schedules (group_id, weekday, start_time, end_time, room_id)
    values ('30000000-0000-0000-0000-000000000002', 3, '19:30', '20:30', '50000000-0000-0000-0000-000000000001');
  raise notice 'OK horario seguido en el mismo salón permitido';
end $$;

do $$ begin
  insert into groups (id, name, level_id, teacher_id)
    values ('30000000-0000-0000-0000-000000000003', 'A1 Lunes 2', 1, '00000000-0000-0000-0000-0000000000a2');
  insert into group_schedules (group_id, weekday, start_time, end_time)
    values ('30000000-0000-0000-0000-000000000003', 1, '18:30', '19:00');
  raise exception 'FALLO: permitió al profesor dos grupos a la misma hora';
exception when others then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK profesor ocupado → %', sqlerrm;
end $$;

do $$ begin
  update groups set teacher_id = '00000000-0000-0000-0000-0000000000a3'
    where id = '30000000-0000-0000-0000-000000000001';
  raise exception 'FALLO: permitió un profesor que no enseña ese nivel';
exception when others then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK nivel del profesor → %', sqlerrm;
end $$;

do $$ begin
  insert into students (doc_number, first_name, last_name, status) values ('200009', 'X', 'Y', 'withdrawn');
  raise exception 'FALLO: permitió un retiro sin fecha';
exception when others then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK retiro exige fecha';
end $$;

do $$
declare m int;
begin
  select months_studied into m from student_overview where id = '60000000-0000-0000-0000-000000000001';
  if m not between 12 and 14 then raise exception 'FALLO: meses estudiados = %', m; end if;
  raise notice 'OK meses estudiados = %', m;
end $$;

-- ---------------------------------------------------------------------
-- Políticas por rol
-- ---------------------------------------------------------------------
set local role authenticated;

-- Director: ve todo.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ begin
  if (select count(*) from students) <> 3 then raise exception 'FALLO: director no ve los 3 estudiantes'; end if;
  if (select count(*) from student_overview) <> 3 then raise exception 'FALLO: director no ve la vista completa'; end if;
  raise notice 'OK director ve todo';
end $$;

-- Profesor Laura (grupo A1): solo sus estudiantes, sus sesiones publicadas y su horario.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$ begin
  if (select count(*) from students) <> 2 then raise exception 'FALLO: profesor ve % estudiantes', (select count(*) from students); end if;
  if (select count(*) from class_sessions) <> 1 then raise exception 'FALLO: profesor ve sesiones de más'; end if;
  if (select count(*) from group_schedules) <> 1 then raise exception 'FALLO: profesor ve horarios de otros grupos'; end if;
  if (select count(*) from payments) <> 0 then raise exception 'FALLO: profesor ve pagos'; end if;
  if (select count(*) from profiles) <> 1 then raise exception 'FALLO: profesor ve perfiles ajenos'; end if;
  if (select count(*) from rooms) <> 2 then raise exception 'FALLO: profesor no ve los salones'; end if;
  raise notice 'OK profesor ve solo lo suyo';
end $$;

do $$ begin
  insert into students (doc_number, first_name, last_name) values ('299999', 'No', 'Debe');
  raise exception 'FALLO: profesor pudo crear estudiantes';
exception when others then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK profesor no crea estudiantes';
end $$;

-- Estudiante con cuenta (Fase 2): solo su ficha, su grupo y sus sesiones publicadas.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
do $$ begin
  if (select count(*) from students) <> 1 then raise exception 'FALLO: estudiante ve otras fichas'; end if;
  if (select count(*) from groups) <> 1 then raise exception 'FALLO: estudiante ve otros grupos'; end if;
  if (select count(*) from class_sessions) <> 1 then raise exception 'FALLO: estudiante ve sesiones de más'; end if;
  if (select count(*) from payments) <> 0 then raise exception 'FALLO: estudiante ve pagos ajenos'; end if;
  if (select count(*) from account_activations) <> 0 then raise exception 'FALLO: se ven códigos de activación'; end if;
  raise notice 'OK estudiante ve solo lo suyo';
end $$;

rollback;
