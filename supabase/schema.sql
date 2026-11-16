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

-- ─────────────────────────────── v4: 용량 제한 (사용자당 2.8MB + 항목별 글자 수)
alter table public.notes drop constraint if exists notes_title_len;
alter table public.notes drop constraint if exists notes_body_len;
alter table public.notes drop constraint if exists notes_tags_len;
alter table public.notes add constraint notes_title_len check (char_length(title) <= 200);
alter table public.notes add constraint notes_body_len check (char_length(body) <= 50000);
alter table public.notes add constraint notes_tags_len check (cardinality(tags) <= 10);

alter table public.cards drop constraint if exists cards_question_len;
alter table public.cards drop constraint if exists cards_answer_len;
alter table public.cards drop constraint if exists cards_project_len;
alter table public.cards drop constraint if exists cards_tags_len;
alter table public.cards drop constraint if exists cards_follow_ups_len;
alter table public.cards add constraint cards_question_len check (char_length(question) <= 1000);
alter table public.cards add constraint cards_answer_len check (char_length(answer) <= 5000);
alter table public.cards add constraint cards_project_len check (char_length(project) <= 3000);
alter table public.cards add constraint cards_tags_len check (cardinality(tags) <= 10);
alter table public.cards add constraint cards_follow_ups_len check (
  jsonb_typeof(follow_ups) = 'array' and jsonb_array_length(follow_ups) <= 10 and octet_length(follow_ups::text) <= 30000
);

create or replace function public.note_bytes(n public.notes)
returns bigint language sql immutable set search_path = '' as $$
  select octet_length(n.title)::bigint + octet_length(n.body) + coalesce(octet_length(array_to_string(n.tags, ',')), 0)
$$;

create or replace function public.card_bytes(c public.cards)
returns bigint language sql immutable set search_path = '' as $$
  select octet_length(c.question)::bigint + octet_length(c.answer) + octet_length(c.project)
       + octet_length(c.follow_ups::text) + coalesce(octet_length(array_to_string(c.tags, ',')), 0)
$$;

create or replace function public.usage_bytes(uid uuid, skip_id uuid default null)
returns bigint language sql stable set search_path = '' as $$
  select coalesce((select sum(public.note_bytes(n)) from public.notes n where n.user_id = uid and n.id is distinct from skip_id), 0)::bigint
       + coalesce((select sum(public.card_bytes(c)) from public.cards c where c.user_id = uid and c.id is distinct from skip_id), 0)::bigint
$$;

-- 한도 변경은 여기 숫자만 바꾸면 됨 (2.8 * 1024 * 1024). 앱의 src/lib/limits.ts 도 같이 수정
create or replace function public.storage_limit_bytes()
returns bigint language sql immutable set search_path = '' as $$ select 2936012::bigint $$;

create or replace function public.enforce_note_limit()
returns trigger language plpgsql set search_path = '' as $$
declare total bigint;
begin
  if tg_op = 'UPDATE' and public.note_bytes(new) <= public.note_bytes(old) then return new; end if;
  total := public.usage_bytes(new.user_id, new.id) + public.note_bytes(new);
  if total > public.storage_limit_bytes() then
    raise exception using errcode = 'P0001', message = 'STORAGE_LIMIT', detail = total::text;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_card_limit()
returns trigger language plpgsql set search_path = '' as $$
declare total bigint;
begin
  if tg_op = 'UPDATE' and public.card_bytes(new) <= public.card_bytes(old) then return new; end if;
  total := public.usage_bytes(new.user_id, new.id) + public.card_bytes(new);
  if total > public.storage_limit_bytes() then
    raise exception using errcode = 'P0001', message = 'STORAGE_LIMIT', detail = total::text;
  end if;
  return new;
end;
$$;

drop trigger if exists notes_storage_limit on public.notes;
create trigger notes_storage_limit before insert or update on public.notes
  for each row execute function public.enforce_note_limit();

drop trigger if exists cards_storage_limit on public.cards;
create trigger cards_storage_limit before insert or update on public.cards
  for each row execute function public.enforce_card_limit();

create or replace function public.my_usage()
returns bigint language sql stable set search_path = '' as $$
  select public.usage_bytes((select auth.uid()), null)
$$;

revoke execute on function public.note_bytes(public.notes), public.card_bytes(public.cards),
  public.usage_bytes(uuid, uuid), public.storage_limit_bytes(), public.my_usage(),
  public.enforce_note_limit(), public.enforce_card_limit() from public, anon;
grant execute on function public.note_bytes(public.notes), public.card_bytes(public.cards),
  public.usage_bytes(uuid, uuid), public.storage_limit_bytes(), public.my_usage() to authenticated;
