-- პრეს ცენტრის მართვის ცენტრი: initial schema

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Roles and permissions
-- ---------------------------------------------------------------------------

-- Permission keys understood by the app. Admins tick these per role.
--   events.create     create shoots
--   events.edit_all   edit / cancel any shoot (creators can always edit their own)
--   events.view_all   see every shoot (otherwise only the ones you are assigned to)
--   events.assign     assign staff to shoots
--   users.manage      add / edit / deactivate users
--   roles.manage      add / edit roles and their permissions
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- shown in the assignment picker as a staff position (operator, driver...)
  is_position boolean not null default true,
  permissions text[] not null default '{}',
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

insert into public.roles (name, is_position, permissions, sort_order) values
  ('ადმინისტრატორი', false, array['events.create','events.edit_all','events.view_all','events.assign','users.manage','roles.manage'], 0),
  ('სააგენტოს უფროსი', false, array['events.create','events.edit_all','events.view_all','events.assign'], 10),
  ('პრესის უფროსი', true, array['events.create','events.edit_all','events.view_all','events.assign'], 20),
  ('პრესოფიცერი', true, array['events.create','events.view_all','events.assign'], 30),
  ('ოპერატორი', true, '{}', 40),
  ('ფოტოგრაფი', true, '{}', 50),
  ('მემონტაჟე', true, '{}', 60),
  ('მძღოლი', true, '{}', 70),
  ('დრონის ოპერატორი', true, '{}', 80),
  ('პროტოკოლი', true, '{}', 90);

-- ---------------------------------------------------------------------------
-- Profiles (one per allowed user; created by an admin before first login)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  username text unique,
  full_name text not null,
  role_id uuid references public.roles (id) on delete set null,
  phone text,
  whatsapp text,
  telegram_chat_id text,
  telegram_link_token text unique default encode(extensions.gen_random_bytes(12), 'hex'),
  ics_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  notify_email boolean not null default true,
  notify_sms boolean not null default false,
  notify_whatsapp boolean not null default true,
  notify_telegram boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role_id);

-- ---------------------------------------------------------------------------
-- Events (shoots)
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  duration_minutes int not null check (duration_minutes > 0),
  ends_at timestamptz not null, -- maintained by trigger from starts_at + duration
  -- one-way travel time from the press center; staff are busy from
  -- starts_at - travel to ends_at + travel
  travel_minutes int not null default 0 check (travel_minutes >= 0),
  location_name text,
  map_url text,
  location_photo_path text,
  contact_name text,
  contact_phone text,
  status text not null default 'planned' check (status in ('planned', 'cancelled', 'done')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_starts_at_idx on public.events (starts_at);

create table public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- the position this person fills on this shoot (may differ from their main role)
  role_id uuid references public.roles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create index event_assignments_profile_idx on public.event_assignments (profile_id);

-- ---------------------------------------------------------------------------
-- Notification outbox
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'telegram')),
  kind text not null check (kind in ('assigned', 'updated', 'cancelled', 'unassigned', 'reminder')),
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notifications_pending_idx on public.notifications (created_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.has_perm(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    join roles r on r.id = p.role_id
    where p.id = auth.uid() and p.active and perm = any (r.permissions)
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;

create or replace function public.is_assigned(ev uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from event_assignments where event_id = ev and profile_id = auth.uid());
$$;

create or replace function public.events_before_write()
returns trigger
language plpgsql
as $$
begin
  new.ends_at = new.starts_at + make_interval(mins => new.duration_minutes);
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_before_write before insert or update on public.events
  for each row execute function public.events_before_write();

-- Staff whose busy window (shoot +/- travel) overlaps the given window.
-- Used to warn coordinators; assignments are still allowed.
create or replace function public.staff_conflicts(
  p_start timestamptz,
  p_end timestamptz,
  p_travel int default 0,
  p_exclude_event uuid default null
)
returns table (
  profile_id uuid,
  event_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  travel_minutes int
)
language sql
stable
security definer
set search_path = public
as $$
  select a.profile_id, e.id, e.title, e.starts_at, e.ends_at, e.travel_minutes
  from event_assignments a
  join events e on e.id = a.event_id
  where public.is_active_user()
    and e.status <> 'cancelled'
    and (p_exclude_event is null or e.id <> p_exclude_event)
    and tstzrange(e.starts_at - make_interval(mins => e.travel_minutes),
                  e.ends_at + make_interval(mins => e.travel_minutes))
        && tstzrange(p_start - make_interval(mins => p_travel),
                     p_end + make_interval(mins => p_travel));
$$;

-- Username -> email lookup for username/password login (called with service role only).
create or replace function public.email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from profiles where lower(username) = lower(p_username) and active limit 1;
$$;

revoke execute on function public.email_for_username(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_assignments enable row level security;
alter table public.notifications enable row level security;

create policy roles_read on public.roles for select to authenticated
  using (public.is_active_user());
create policy roles_write on public.roles for all to authenticated
  using (public.has_perm('roles.manage')) with check (public.has_perm('roles.manage'));

create policy profiles_read on public.profiles for select to authenticated
  using (public.is_active_user());
create policy profiles_admin on public.profiles for all to authenticated
  using (public.has_perm('users.manage')) with check (public.has_perm('users.manage'));
-- Users may edit their own contact details and notification preferences;
-- the column list below keeps them from changing their role or active flag.
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, phone, whatsapp, notify_email, notify_sms, notify_whatsapp, notify_telegram)
  on public.profiles to authenticated;

create policy events_read on public.events for select to authenticated
  using (public.has_perm('events.view_all') or created_by = auth.uid() or public.is_assigned(id));
create policy events_insert on public.events for insert to authenticated
  with check (public.has_perm('events.create') and created_by = auth.uid());
create policy events_update on public.events for update to authenticated
  using (public.has_perm('events.edit_all') or (created_by = auth.uid() and public.has_perm('events.create')))
  with check (true);
create policy events_delete on public.events for delete to authenticated
  using (public.has_perm('events.edit_all'));

create policy assignments_read on public.event_assignments for select to authenticated
  using (public.has_perm('events.view_all') or profile_id = auth.uid() or public.is_assigned(event_id));
create policy assignments_write on public.event_assignments for all to authenticated
  using (public.has_perm('events.assign')) with check (public.has_perm('events.assign'));

create policy notifications_read on public.notifications for select to authenticated
  using (profile_id = auth.uid() or public.has_perm('users.manage'));

-- ---------------------------------------------------------------------------
-- Storage: location photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('location-photos', 'location-photos', false)
  on conflict (id) do nothing;

create policy location_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'location-photos' and public.is_active_user());
create policy location_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'location-photos' and (public.has_perm('events.create') or public.has_perm('events.edit_all')));
create policy location_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'location-photos' and (public.has_perm('events.create') or public.has_perm('events.edit_all')));
