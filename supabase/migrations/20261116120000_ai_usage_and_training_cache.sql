-- 階段 4：弱點特訓（LLM）
-- ai_usage：AI 功能的用量紀錄，一列是一次請求。每人每日上限用它來數，也記錄生成品質（期末報告用）。
-- training_cache：題庫快取，相同的「prompt 版本＋難度＋主題＋弱點組合」24 小時內重複使用。
--
-- 這兩張表只有 Edge Function（service_role）能碰：都開 RLS、不給任何 policy，
-- 也收回 anon／authenticated 的權限；底下的函式同樣只有 service_role 可以執行。

create table public.ai_usage (
  id             bigint generated always as identity primary key,
  user_id        uuid        not null references auth.users (id) on delete cascade,
  -- 哪個功能：training（弱點特訓）；之後的每週建議、故事模式共用這張表與同一個每日上限
  feature        text        not null check (feature ~ '^[a-z_]{1,32}$'),
  -- 算在哪一天：以台灣時間（UTC+8，沒有日光節約時間）的日期為準，所以「隔天」是台灣的午夜
  usage_day      date        not null default ((now() at time zone 'utc') + interval '8 hours')::date,
  -- pending：已佔用、還在生成；cache：快取命中；gemini／groq：由哪一家生成；failed：兩家都失敗
  source         text        not null default 'pending' check (source in ('pending', 'cache', 'gemini', 'groq', 'failed')),
  -- 是否計入每日上限：快取命中與生成失敗都不計
  counted        boolean     not null default true,
  -- 請求內容：{ difficulty, theme, weaknesses }
  request        jsonb,
  prompt_version text,
  -- 最後一次嘗試用的模型
  model          text,
  -- 所有嘗試加起來花的毫秒數
  latency_ms     integer     check (latency_ms is null or latency_ms >= 0),
  -- 最後一次嘗試：LLM 給了幾題、驗證後剩幾題、主要的不合格原因（length、missing_target、not_ascii、banned_word、http_429、timeout…）
  raw_count      integer     check (raw_count is null or raw_count >= 0),
  valid_count    integer     check (valid_count is null or valid_count >= 0),
  reject_reason  text,
  -- 每一次嘗試的細節：[{ provider, model, ok, latency_ms, raw_count, valid_count, reason, rejects }]
  attempts       jsonb       not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

create index ai_usage_user_day_idx on public.ai_usage (user_id, usage_day) where counted;

create table public.training_cache (
  cache_key      text        primary key,
  prompt_version text        not null,
  difficulty     text        not null check (difficulty in ('easy', 'normal', 'hard')),
  theme          text        not null,
  weaknesses     text[]      not null,
  -- 通過驗證的題目（字串陣列）
  items          jsonb       not null check (jsonb_typeof(items) = 'array'),
  provider       text        not null,
  model          text        not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null
);

alter table public.ai_usage enable row level security;
alter table public.training_cache enable row level security;
revoke all on public.ai_usage, public.training_cache from anon, authenticated;
grant all on public.ai_usage, public.training_cache to service_role;

-- 檢查今天的次數並先佔一次。同一位使用者的請求用 advisory lock 排隊，同時送很多請求也不會超過上限。
create function public.ai_usage_begin(p_user uuid, p_feature text, p_limit integer, p_request jsonb default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_day  date := ((now() at time zone 'utc') + interval '8 hours')::date;
  v_used integer;
  v_id   bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select count(*) into v_used from public.ai_usage where user_id = p_user and usage_day = v_day and counted;
  if v_used >= p_limit then
    return jsonb_build_object('allowed', false, 'id', null, 'used', v_used);
  end if;
  insert into public.ai_usage (user_id, feature, usage_day, request)
    values (p_user, p_feature, v_day, p_request)
    returning id into v_id;
  return jsonb_build_object('allowed', true, 'id', v_id, 'used', v_used + 1);
end;
$$;

-- 生成結束後補上結果。失敗時 counted 是 false，等於把這一次退還。
create function public.ai_usage_finish(p_id bigint, p_result jsonb)
returns void
language sql
set search_path = ''
as $$
  update public.ai_usage set
    source         = p_result ->> 'source',
    counted        = coalesce((p_result ->> 'counted')::boolean, true),
    prompt_version = p_result ->> 'prompt_version',
    model          = p_result ->> 'model',
    latency_ms     = (p_result ->> 'latency_ms')::integer,
    raw_count      = (p_result ->> 'raw_count')::integer,
    valid_count    = (p_result ->> 'valid_count')::integer,
    reject_reason  = p_result ->> 'reject_reason',
    attempts       = coalesce(p_result -> 'attempts', '[]'::jsonb)
  where id = p_id;
$$;

-- 記一筆快取命中（不計入上限），回傳這位使用者今天已經用掉的次數。
create function public.ai_usage_cache_hit(p_user uuid, p_feature text, p_request jsonb, p_result jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_day  date := ((now() at time zone 'utc') + interval '8 hours')::date;
  v_used integer;
begin
  insert into public.ai_usage (user_id, feature, usage_day, source, counted, request, prompt_version, model, valid_count)
    values (p_user, p_feature, v_day, 'cache', false, p_request, p_result ->> 'prompt_version', p_result ->> 'model', (p_result ->> 'valid_count')::integer);
  select count(*) into v_used from public.ai_usage where user_id = p_user and usage_day = v_day and counted;
  return v_used;
end;
$$;

-- 讀快取：只回傳還沒過期的。
create function public.training_cache_get(p_key text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('items', c.items, 'provider', c.provider, 'model', c.model)
  from public.training_cache c
  where c.cache_key = p_key and c.expires_at > now();
$$;

-- 寫快取：同一個鍵直接蓋掉，並順手清掉已經過期的。
create function public.training_cache_put(
  p_key text, p_prompt_version text, p_difficulty text, p_theme text, p_weaknesses text[],
  p_items jsonb, p_provider text, p_model text, p_ttl_hours integer
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.training_cache where expires_at <= now();
  insert into public.training_cache (cache_key, prompt_version, difficulty, theme, weaknesses, items, provider, model, expires_at)
    values (p_key, p_prompt_version, p_difficulty, p_theme, p_weaknesses, p_items, p_provider, p_model, now() + make_interval(hours => p_ttl_hours))
    on conflict (cache_key) do update set
      prompt_version = excluded.prompt_version, difficulty = excluded.difficulty, theme = excluded.theme, weaknesses = excluded.weaknesses,
      items = excluded.items, provider = excluded.provider, model = excluded.model, created_at = now(), expires_at = excluded.expires_at;
end;
$$;

revoke execute on function
  public.ai_usage_begin(uuid, text, integer, jsonb),
  public.ai_usage_finish(bigint, jsonb),
  public.ai_usage_cache_hit(uuid, text, jsonb, jsonb),
  public.training_cache_get(text),
  public.training_cache_put(text, text, text, text, text[], jsonb, text, text, integer)
  from public, anon, authenticated;
grant execute on function
  public.ai_usage_begin(uuid, text, integer, jsonb),
  public.ai_usage_finish(bigint, jsonb),
  public.ai_usage_cache_hit(uuid, text, jsonb, jsonb),
  public.training_cache_get(text),
  public.training_cache_put(text, text, text, text, text[], jsonb, text, text, integer)
  to service_role;
