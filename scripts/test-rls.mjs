// 在內嵌的 Postgres（PGlite，不需要 Docker）裡跑 supabase/migrations 的每一個 migration，
// 再模擬兩個登入帳號和一個沒登入的訪客，檢查 Row Level Security 與各種限制。
// 用法：npm run test:db
//
// Supabase 專有的部分（auth.users、auth.uid()、anon／authenticated 角色）這裡用最小的替身代替；
// 真的專案上的行為仍然要照 docs/DEVLOG.md 的步驟用兩個帳號實測一次。
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
const db = new PGlite()

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`)

const ALICE = '00000000-0000-0000-0000-00000000000a'
const BOB = '00000000-0000-0000-0000-00000000000b'
// 一個帳號在 migration 之前就存在（測試補建玩家資料），另一個之後才註冊（測試觸發器）
await db.query(`insert into auth.users values ($1, $2)`, [ALICE, { user_name: 'alice' }])

for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(dir + file, 'utf8'))
  console.log(`✓ migration ${file}`)
}
await db.query(`insert into auth.users values ($1, $2)`, [BOB, { full_name: 'Bob B' }])

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  ← ${detail}`}`)
}
/** 用某個身分跑一段 SQL；uid 是 null 表示沒登入（anon） */
async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`)
  try {
    return { rows: (await db.query(sql, params)).rows, error: null }
  } catch (error) {
    return { rows: [], error }
  } finally {
    await db.exec(`reset role`)
  }
}
const denied = (r) => r.error !== null

// ---- 每張表都開了 RLS ----
const tables = ['profiles', 'game_records', 'best_records', 'key_stats']
const rls = await db.query(`select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`)
for (const t of tables) check(`${t} 開啟 RLS`, rls.rows.find((r) => r.relname === t)?.relrowsecurity === true)
check('public 裡沒有沒開 RLS 的表', rls.rows.every((r) => r.relrowsecurity), JSON.stringify(rls.rows))

// ---- 玩家資料 ----
const profiles = await db.query(`select id, display_name from public.profiles order by display_name`)
check('註冊前後的帳號都有玩家資料', profiles.rows.length === 2 && profiles.rows[0].display_name === 'Bob B' && profiles.rows[1].display_name === 'alice', JSON.stringify(profiles.rows))
check('只看得到自己的玩家資料', (await as(ALICE, `select * from public.profiles`)).rows.length === 1)
check('可以改自己的勇者', (await as(ALICE, `update public.profiles set hero = 'panda' where id = $1 returning hero`, [ALICE])).rows[0]?.hero === 'panda')
check('改不到別人的玩家資料', (await as(ALICE, `update public.profiles set hero = 'cat' where id = $1 returning id`, [BOB])).rows.length === 0)
check('勇者只能是四種之一', denied(await as(ALICE, `update public.profiles set hero = 'dragon' where id = $1`, [ALICE])))
check('不能把玩家資料的 id 改成別人', denied(await as(ALICE, `update public.profiles set id = $2 where id = $1`, [ALICE, BOB])))
check('不能自己新增玩家資料', denied(await as(ALICE, `insert into public.profiles (id) values (gen_random_uuid())`)))

// ---- 場次與按鍵統計 ----
const game = (id) => `('${id}', '2026-11-16T03:00:00Z', 'classic', 'easy', true, 42, 96.5, 30, 3000, 290, 61234, 3)`
const cols = `(id, played_at, mode, difficulty, win, wpm, accuracy, max_combo, score, damage, duration_ms, stage)`
check('登入後可以新增自己的場次（user_id 自動帶入）', !denied(await as(ALICE, `insert into public.game_records ${cols} values ${game('g1')}`)))
check('不同帳號可以用相同的場次 id', !denied(await as(BOB, `insert into public.game_records ${cols} values ${game('g1')}`)))
check('不能用別人的 user_id 新增場次', denied(await as(ALICE, `insert into public.game_records (user_id, ${cols.slice(1)} values ('${BOB}', ${game('g2').slice(1)}`)))
check('重複上傳同一場（upsert）不會變兩筆', !denied(await as(ALICE, `insert into public.game_records ${cols} values ${game('g1')} on conflict (user_id, id) do update set score = excluded.score`)) && (await as(ALICE, `select * from public.game_records`)).rows.length === 1)
check('WPM 超出合理範圍會被拒絕', denied(await as(ALICE, `insert into public.game_records ${cols} values ${game('g3').replace('42', '9999')}`)))

const stat = (session, kind, key, extra = '5, 1, 3, 600') => `('${session}:${kind}:${key}', '${session}', '2026-11-16T03:00:00Z', '${kind}', '${key}', ${extra})`
const statCols = `(id, session_id, played_at, kind, key, attempts, errors, timed_count, total_ms)`
check('可以新增自己場次的按鍵統計', !denied(await as(ALICE, `insert into public.key_stats ${statCols} values ${stat('g1', 'char', 'e')}, ${stat('g1', 'bigram', 'th')}, ${stat('g1', 'char', ' ')}`)))
check('統計一定要掛在自己的場次底下', denied(await as(ALICE, `insert into public.key_stats ${statCols} values ${stat('nope', 'char', 'e')}`)))
check('不合法的鍵會被拒絕（大寫、三個字母的組合）', denied(await as(ALICE, `insert into public.key_stats ${statCols} values ${stat('g1', 'char', 'E')}`)) && denied(await as(ALICE, `insert into public.key_stats ${statCols} values ${stat('g1', 'bigram', 'the')}`)))
check('錯誤數不能比次數多', denied(await as(ALICE, `insert into public.key_stats ${statCols} values ${stat('g1', 'char', 'x', '2, 5, 0, 0')}`)))

for (const t of ['game_records', 'key_stats']) {
  check(`${t}：另一個帳號查不到`, (await as(BOB, `select * from public.${t} where user_id = $1`, [ALICE])).rows.length === 0)
  check(`${t}：另一個帳號改不到`, (await as(BOB, `update public.${t} set played_at = now() where user_id = $1 returning id`, [ALICE])).rows.length === 0)
  check(`${t}：另一個帳號刪不到`, (await as(BOB, `delete from public.${t} where user_id = $1 returning id`, [ALICE])).rows.length === 0)
}
check('不能把自己的場次改成別人的', denied(await as(ALICE, `update public.game_records set user_id = $1`, [BOB])))

// ---- 最佳紀錄 ----
const best = (score, wpm, clears) => `insert into public.best_records (difficulty, score, wpm, max_combo, accuracy, clears) values ('easy', ${score}, ${wpm}, 10, 90, ${clears})
  on conflict (user_id, difficulty) do update set score = excluded.score, wpm = excluded.wpm, max_combo = excluded.max_combo, accuracy = excluded.accuracy, clears = excluded.clears`
await as(ALICE, best(3000, 40, 5))
await as(ALICE, best(2000, 55, 3))
const kept = (await as(ALICE, `select score, wpm, clears from public.best_records`)).rows[0]
check('最佳紀錄只會變好：舊的上傳不會蓋掉比較好的數字', kept?.score === 3000 && kept?.wpm === 55 && kept?.clears === 5, JSON.stringify(kept))
check('best_records：另一個帳號查不到', (await as(BOB, `select * from public.best_records`)).rows.length === 0)

// ---- 沒登入 ----
for (const t of tables) check(`${t}：沒登入不能讀`, denied(await as(null, `select * from public.${t}`)))
check('沒登入不能新增場次', denied(await as(null, `insert into public.game_records ${cols} values ${game('g9')}`)))

// ---- 刪除 ----
await as(ALICE, `delete from public.game_records where id = 'g1'`)
check('刪除場次時，底下的按鍵統計一起刪掉', (await as(ALICE, `select * from public.key_stats`)).rows.length === 0)
check('刪除不會影響別人的場次', (await as(BOB, `select * from public.game_records`)).rows.length === 1)
await db.query(`delete from auth.users where id = $1`, [BOB])
const left = await db.query(`select (select count(*) from public.profiles where id = $1) + (select count(*) from public.game_records where user_id = $1) as n`, [BOB])
check('刪除帳號時，玩家資料與場次一起刪掉', Number(left.rows[0].n) === 0)

console.log(failed === 0 ? '\n全部通過 🎉' : `\n${failed} 項沒通過`)
process.exit(failed === 0 ? 0 : 1)
