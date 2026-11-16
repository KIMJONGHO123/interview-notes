-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다(이미 있는 건 건너뜀). 업데이트 후에도 다시 실행하면 됩니다.

-- updated_at 자동 갱신 함수
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
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
  follow_ups       jsonb not null default '[]'::jsonb,   -- [{ "q": 꼬리질문, "a": 답 }]
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

-- v3: 꼬리질문을 text[] → jsonb [{q, a}] 로 변경 (예전 문자열은 앱이 "질문 (답)" 괄호로 자동 분리)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cards' and column_name = 'follow_ups' and data_type = 'ARRAY'
  ) then
    alter table public.cards alter column follow_ups drop default;
    alter table public.cards alter column follow_ups type jsonb using to_jsonb(follow_ups);
    alter table public.cards alter column follow_ups set default '[]'::jsonb;
  end if;
end;
$$;

create index if not exists cards_user_id_idx on public.cards (user_id);
create index if not exists cards_note_id_idx on public.cards (note_id);

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ─────────────────────────────── Data API 권한
-- "Automatically expose new tables" 를 꺼도 동작하도록 명시적으로 부여.
-- 로그인한 사용자(authenticated)만 접근, 비로그인(anon)은 접근 불가.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.notes, public.cards to authenticated;
revoke all on public.notes, public.cards from anon;

-- ─────────────────────────────── RLS: 로그인한 본인 데이터만
-- (select auth.uid()) 형태로 써야 행마다 재계산하지 않아 빠름
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
    execute format('create policy "%1$s_select_own" on public.%1$s for select using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s for insert with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_update_own" on public.%1$s for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s for delete using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- "Enable automatic RLS" 옵션이 만든 함수가 API(rpc)로 호출되지 않게 막기 (이벤트 트리거로만 동작하면 됨)
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
