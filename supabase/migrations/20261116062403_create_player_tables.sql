-- Typing Paws 2.0：玩家資料、場次成績、最佳紀錄、按鍵統計（ROADMAP 3.2）
--
-- 原則
-- * 每張表都開 Row Level Security：登入的人只能讀寫 user_id 是自己的列；沒登入（anon）完全碰不到。
-- * 場次與統計的 id 是前端產生的文字（本機先存、之後才上傳），所以主鍵是 (user_id, id)：
--   重複上傳同一場會被 upsert 蓋掉而不會變兩筆，而且別人用了相同的 id 也不會互相干擾。
-- * 欄位對應 src/game/records.ts 的 GameRecord / BestRecord 與 src/game/keystats.ts 的 KeyStatRow。

-- ───────────────────────── 玩家資料 ─────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  -- 顯示名稱：註冊時從登入供應商帶入，之後排行榜會用到
  display_name text check (display_name is null or char_length(display_name) between 1 and 40),
  -- 選中的勇者；null 表示還沒選過
  hero         text check (hero is null or hero in ('cat', 'shiba', 'bunny', 'panda')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is '玩家資料，一個登入帳號一列';

-- ───────────────────────── 場次成績 ─────────────────────────

create table public.game_records (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id          text        not null check (char_length(id) between 1 and 80),
  played_at   timestamptz not null,
  mode        text        not null check (mode in ('classic', 'story', 'training', 'daily')),
  difficulty  text        not null check (difficulty in ('easy', 'normal', 'hard')),
  win         boolean     not null,
  wpm         integer     not null check (wpm between 0 and 400),
  accuracy    numeric(4, 1) not null check (accuracy between 0 and 100),
  max_combo   integer     not null check (max_combo >= 0),
  score       integer     not null check (score >= 0),
  -- 從 1.0 匯入的舊紀錄沒有這兩個數字
  damage      integer     check (damage is null or damage >= 0),
  duration_ms integer     check (duration_ms is null or duration_ms >= 0),
  stage       integer     not null check (stage between 1 and 100),
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);

comment on table public.game_records is '每一場的成績，對應前端的 GameRecord';

create index game_records_user_played_at_idx on public.game_records (user_id, played_at desc);

-- ───────────────────────── 最佳紀錄 ─────────────────────────
-- 另外存一張表而不是從 game_records 算：從 1.0 匯入的最佳紀錄、以及超過本機 30 場上限的舊場次，
-- 都沒有對應的場次資料可以算。

create table public.best_records (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  difficulty text    not null check (difficulty in ('easy', 'normal', 'hard')),
  score      integer not null default 0 check (score >= 0),
  wpm        integer not null default 0 check (wpm between 0 and 400),
  max_combo  integer not null default 0 check (max_combo >= 0),
  accuracy   numeric(4, 1) not null default 0 check (accuracy between 0 and 100),
  clears     integer not null default 0 check (clears >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, difficulty)
);

comment on table public.best_records is '各難度的最佳紀錄，對應前端的 BestRecord';

-- 最佳紀錄只會變好不會變差：兩台裝置先後上傳時，比較舊的那一份不會把比較好的蓋掉。
-- （要歸零只能刪除整列，也就是「清除紀錄」。）
create function public.best_records_keep_best()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.score      := greatest(old.score, new.score);
  new.wpm        := greatest(old.wpm, new.wpm);
  new.max_combo  := greatest(old.max_combo, new.max_combo);
  new.accuracy   := greatest(old.accuracy, new.accuracy);
  new.clears     := greatest(old.clears, new.clears);
  new.updated_at := now();
  return new;
end;
$$;

create trigger best_records_keep_best
  before update on public.best_records
  for each row execute function public.best_records_keep_best();

-- ───────────────────────── 按鍵統計 ─────────────────────────

create table public.key_stats (
  user_id     uuid        not null default auth.uid(),
  -- `${session_id}:${kind}:${key}`
  id          text        not null check (char_length(id) between 1 and 120),
  session_id  text        not null,
  played_at   timestamptz not null,
  kind        text        not null check (kind in ('char', 'bigram')),
  key         text        not null,
  attempts    integer     not null check (attempts >= 0),
  errors      integer     not null check (errors >= 0),
  timed_count integer     not null check (timed_count >= 0),
  total_ms    integer     not null check (total_ms >= 0),
  primary key (user_id, id),
  -- 場次刪掉時，底下的統計一起刪
  foreign key (user_id, session_id) references public.game_records (user_id, id) on delete cascade,
  check (errors <= attempts and timed_count <= attempts),
  -- char：一個可列印 ASCII 字元（不含大寫）；bigram：兩個小寫字母（和前端的 isStatKey 相同）
  check (
    (kind = 'char' and key ~ '^[ -~]$' and key !~ '[A-Z]')
    or (kind = 'bigram' and key ~ '^[a-z]{2}$')
  )
);

comment on table public.key_stats is '某一場裡某個鍵或字母組合的統計，對應前端的 KeyStatRow';

create index key_stats_user_session_idx on public.key_stats (user_id, session_id);
create index key_stats_user_played_at_idx on public.key_stats (user_id, played_at desc);

-- ───────────────────────── updated_at ─────────────────────────

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ───────────────────────── 註冊時自動建立玩家資料 ─────────────────────────

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ), 40), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 這個函式只給觸發器用，不開放從 API 呼叫
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 跑這個 migration 之前就已經註冊的帳號，補上玩家資料
insert into public.profiles (id, display_name)
select
  u.id,
  nullif(left(coalesce(
    u.raw_user_meta_data ->> 'user_name',
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    ''
  ), 40), '')
from auth.users u
on conflict (id) do nothing;

-- ───────────────────────── 權限與 Row Level Security ─────────────────────────

alter table public.profiles     enable row level security;
alter table public.game_records enable row level security;
alter table public.best_records enable row level security;
alter table public.key_stats    enable row level security;

-- 沒登入的人完全不能碰；登入的人能做什麼再由下面的 policy 限制到「只有自己的列」
revoke all on public.profiles, public.game_records, public.best_records, public.key_stats from anon;
revoke all on public.profiles, public.game_records, public.best_records, public.key_stats from authenticated;

-- 玩家資料：列由觸發器建立、跟著帳號刪除，所以只開放讀取和修改；能改的欄位只有名稱和勇者
grant select on public.profiles to authenticated;
grant update (display_name, hero) on public.profiles to authenticated;
grant select, insert, update, delete on public.game_records, public.best_records, public.key_stats to authenticated;

create policy "讀取自己的玩家資料" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "修改自己的玩家資料" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "讀取自己的場次" on public.game_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "新增自己的場次" on public.game_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "修改自己的場次" on public.game_records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "刪除自己的場次" on public.game_records
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "讀取自己的最佳紀錄" on public.best_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "新增自己的最佳紀錄" on public.best_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "修改自己的最佳紀錄" on public.best_records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "刪除自己的最佳紀錄" on public.best_records
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "讀取自己的按鍵統計" on public.key_stats
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "新增自己的按鍵統計" on public.key_stats
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "修改自己的按鍵統計" on public.key_stats
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "刪除自己的按鍵統計" on public.key_stats
  for delete to authenticated using ((select auth.uid()) = user_id);
