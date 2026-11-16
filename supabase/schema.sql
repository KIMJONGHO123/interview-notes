-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다(이미 있는 건 건너뜀). 업데이트 후에도 다시 실행하면 됩니다.

-- updated_at 자동 갱신 함수
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────── 개념 노트
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null,
  body       text not null default '',
  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on public.notes (user_id);

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ─────────────────────────────── 카드
create table if not exists public.cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question         text not null,
  answer           text not null default '',
  follow_ups       text[] not null default '{}',
  project          text not null default '',
  tags             text[] not null default '{}',
  confidence       text not null default 'mid' check (confidence in ('low', 'mid', 'high')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_reviewed_at timestamptz
);

-- v2: 난이도 + 개념 노트 연결
alter table public.cards
  add column if not exists level text not null default 'interview' check (level in ('basic', 'interview'));
alter table public.cards
  add column if not exists note_id uuid references public.notes (id) on delete set null;

create index if not exists cards_user_id_idx on public.cards (user_id);
create index if not exists cards_note_id_idx on public.cards (note_id);

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ─────────────────────────────── RLS: 로그인한 본인 데이터만
alter table public.notes enable row level security;
alter table public.cards enable row level security;

do $$
declare t text;
begin
  foreach t in array array['notes', 'cards'] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s', t);
    execute format('create policy "%1$s_select_own" on public.%1$s for select using (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_update_own" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s for delete using (auth.uid() = user_id)', t);
  end loop;
end;
$$;
