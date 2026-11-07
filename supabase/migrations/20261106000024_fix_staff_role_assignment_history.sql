-- A role assignment is historical: an employee can be assigned the same role
-- again after an earlier assignment was revoked. The original composite primary
-- key prevented that legitimate re-assignment from being recorded.

alter table public.staff_role_assignments
  add column if not exists id uuid default gen_random_uuid();

update public.staff_role_assignments
set id = gen_random_uuid()
where id is null;

alter table public.staff_role_assignments
  alter column id set not null;

alter table public.staff_role_assignments
  drop constraint if exists staff_role_assignments_pkey;

alter table public.staff_role_assignments
  add constraint staff_role_assignments_pkey primary key (id);

-- A staff member has one current role at a time. Revoked rows remain available
-- as audit history and no longer block assigning the same role later.
create unique index if not exists staff_role_assignments_one_active_role
  on public.staff_role_assignments (staff_profile_id, institution_id)
  where revoked_at is null;

