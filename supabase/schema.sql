-- Noteboard schema
-- Run this in the Supabase SQL editor (Database → SQL editor → New query)

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists folders (
  id               text primary key,
  name             text not null,
  parent_folder_id text,
  owner_id         uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now()
);

create table if not exists boards (
  id               text primary key,
  name             text not null,
  parent_folder_id text,
  owner_id         uuid not null references auth.users(id) on delete cascade,
  share_token      text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists notes (
  id         text primary key,
  board_id   text not null references boards(id) on delete cascade,
  type       text not null,
  x          double precision not null,
  y          double precision not null,
  width      double precision not null,
  height     double precision not null,
  z_index    integer not null default 0,
  content    jsonb not null default '{}',
  color      text,
  font_size  integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists notes_board_id_idx on notes(board_id);
create index if not exists boards_owner_id_idx on boards(owner_id);
create index if not exists folders_owner_id_idx on folders(owner_id);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table folders enable row level security;
alter table boards  enable row level security;
alter table notes   enable row level security;

create policy "folders: owner full access" on folders
  for all using (owner_id = auth.uid());

create policy "boards: owner full access" on boards
  for all using (owner_id = auth.uid());

create policy "notes: owner full access" on notes
  for all using (
    board_id in (select id from boards where owner_id = auth.uid())
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enable Realtime for the notes table so cross-tab/cross-device sync works.
-- In the Supabase dashboard: Database → Replication → supabase_realtime → add "notes"
-- Or run:

alter publication supabase_realtime add table notes;

-- ── Share link functions (SECURITY DEFINER bypasses RLS for public share access) ──

create or replace function get_shared_board(p_token text)
returns setof boards
language sql
security definer
stable
as $$
  select * from boards where share_token = p_token limit 1;
$$;

create or replace function get_shared_notes(p_token text)
returns setof notes
language sql
security definer
stable
as $$
  select n.* from notes n
  join boards b on b.id = n.board_id
  where b.share_token = p_token
  order by n.z_index;
$$;
