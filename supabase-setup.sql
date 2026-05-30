-- ── Noteboard — paste this into Supabase SQL Editor and click Run ────────────

create table if not exists boards (
  id               text primary key,
  name             text not null,
  parent_folder_id text,
  owner_id         text not null,
  share_token      text,
  created_at       text not null,
  updated_at       text not null
);

create table if not exists folders (
  id               text primary key,
  name             text not null,
  parent_folder_id text,
  owner_id         text not null,
  created_at       text not null
);

create table if not exists notes (
  id         text primary key,
  board_id   text not null references boards(id) on delete cascade,
  type       text not null,
  x          real not null,
  y          real not null,
  width      real not null,
  height     real not null,
  z_index    integer not null default 0,
  content    jsonb not null default '{}',
  color      text,
  font_size  integer,
  created_at text not null,
  updated_at text not null
);

create table if not exists connections (
  id           text primary key,
  board_id     text not null references boards(id) on delete cascade,
  from_note_id text not null,
  to_note_id   text not null
);

-- Enable Row Level Security (only you can see your own data)
alter table boards      enable row level security;
alter table folders     enable row level security;
alter table notes       enable row level security;
alter table connections enable row level security;

create policy "own boards" on boards
  for all using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

create policy "own folders" on folders
  for all using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

create policy "notes in own boards" on notes
  for all using (
    exists (select 1 from boards where boards.id = notes.board_id and boards.owner_id = auth.uid()::text)
  );

create policy "connections in own boards" on connections
  for all using (
    exists (select 1 from boards where boards.id = connections.board_id and boards.owner_id = auth.uid()::text)
  );
