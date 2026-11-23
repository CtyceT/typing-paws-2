import { describe, expect, it } from 'vitest'
import type { KeyStatRow } from './keystats.ts'
import type { GameRecord, Records } from './records.ts'
import {
  chunk,
  fromBestRecordRows,
  fromGameRecordRow,
  fromKeyStatDbRows,
  guestMergeOffer,
  mergeBestSameAccount,
  mergeCloud,
  mergeGuest,
  pendingUpload,
  resultSyncStatus,
  syncStatus,
  toBestRecordRows,
  toCloudSnapshot,
  toGameRecordRow,
  toIsoTime,
  toKeyStatDbRow,
} from './sync.ts'

const record = (id: string, playedAt: number, extra: Partial<GameRecord> = {}): GameRecord => ({
  id,
  playedAt,
  mode: 'classic',
  difficulty: 'easy',
  win: true,
  wpm: 42,
  accuracy: 96.5,
  maxCombo: 30,
  score: 3000,
  damage: 290,
  durationMs: 61234.5,
  stage: 3,
  ...extra,
})
const stat = (sessionId: string, key = 'e', extra: Partial<KeyStatRow> = {}): KeyStatRow => ({
  id: `${sessionId}:char:${key}`,
  sessionId,
  playedAt: 1790000000000,
  kind: 'char',
  key,
  attempts: 10,
  errors: 2,
  timedCount: 7,
  totalMs: 1400,
  ...extra,
})

describe('本機資料 → 資料表的列', () => {
  it('場次：欄位改成蛇形命名、時間轉 ISO、小數的毫秒四捨五入', () => {
    expect(toGameRecordRow(record('a', 1790000000000), 'u1')).toEqual({
      user_id: 'u1',
      id: 'a',
      played_at: '2026-09-21T14:13:20.000Z',
      mode: 'classic',
      difficulty: 'easy',
      win: true,
      wpm: 42,
      accuracy: 96.5,
      max_combo: 30,
      score: 3000,
      damage: 290,
      duration_ms: 61235,
      stage: 3,
    })
  })

  it('從 1.0 匯入的場次沒有傷害和時間，維持 null', () => {
    const row = toGameRecordRow(record('v1-1-0', 1, { damage: null, durationMs: null }), 'u1')
    expect(row.damage).toBeNull()
    expect(row.duration_ms).toBeNull()
  })

  it('超出資料表限制的數字會夾到範圍內，不會讓上傳失敗', () => {
    const row = toGameRecordRow(record('x', 1, { wpm: 9999, accuracy: 123.456, stage: 0, score: 1e12, maxCombo: -3 }), 'u1')
    expect(row).toMatchObject({ wpm: 400, accuracy: 100, stage: 1, score: 2147483647, max_combo: 0 })
    expect(toIsoTime(1e20)).toBe('+275760-09-13T00:00:00.000Z')
  })

  it('最佳紀錄：有紀錄的難度各一列', () => {
    const rows = toBestRecordRows({ easy: { score: 3000, wpm: 42, maxCombo: 30, accuracy: 96.5, clears: 2 }, hard: { score: 10, wpm: 0, maxCombo: 3, accuracy: 0, clears: 0 } }, 'u1')
    expect(rows).toEqual([
      { user_id: 'u1', difficulty: 'easy', score: 3000, wpm: 42, max_combo: 30, accuracy: 96.5, clears: 2 },
      { user_id: 'u1', difficulty: 'hard', score: 10, wpm: 0, max_combo: 3, accuracy: 0, clears: 0 },
    ])
  })

  it('按鍵統計：錯誤數和計時次數不會超過次數', () => {
    expect(toKeyStatDbRow(stat('a', 'e', { errors: 99, timedCount: 99 }), 'u1')).toEqual({
      user_id: 'u1',
      id: 'a:char:e',
      session_id: 'a',
      played_at: '2026-09-21T14:13:20.000Z',
      kind: 'char',
      key: 'e',
      attempts: 10,
      errors: 10,
      timed_count: 10,
      total_ms: 1400,
    })
  })
})

describe('還沒上傳的場次', () => {
  const records: Records = { best: {}, history: [record('a', 1), record('b', 2), record('c', 3)] }
  const keyStats = [stat('a'), stat('b'), stat('b', 't'), stat('c'), stat('orphan')]

  it('只挑出待上傳的場次和它們的統計', () => {
    const upload = pendingUpload(records, keyStats, ['b'])
    expect(upload.records.map((r) => r.id)).toEqual(['b'])
    expect(upload.keyStats.map((k) => k.id)).toEqual(['b:char:e', 'b:char:t'])
    expect(upload.gone).toEqual([])
  })

  it('本機已經找不到的場次列在 gone，它的統計也不上傳', () => {
    const upload = pendingUpload(records, keyStats, ['c', 'orphan', 'missing'])
    expect(upload.records.map((r) => r.id)).toEqual(['c'])
    expect(upload.keyStats.map((k) => k.sessionId)).toEqual(['c'])
    expect(upload.gone).toEqual(['orphan', 'missing'])
  })

  it('沒有待上傳的場次時什麼都不傳', () => {
    expect(pendingUpload(records, keyStats, [])).toEqual({ records: [], keyStats: [], gone: [] })
  })

  it('chunk 把列切成固定大小的批次', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 2)).toEqual([])
  })
})

describe('同步狀態的文字', () => {
  it('帳號列', () => {
    expect(syncStatus('idle', 0)).toEqual({ tone: 'ok', text: '已同步' })
    expect(syncStatus('syncing', 2)).toEqual({ tone: 'busy', text: '同步中…' })
    expect(syncStatus('failed', 2)).toEqual({ tone: 'warn', text: '2 場尚未同步' })
    expect(syncStatus('idle', 1)).toEqual({ tone: 'warn', text: '1 場尚未同步' })
    expect(syncStatus('failed', 0)).toEqual({ tone: 'warn', text: '連不上雲端' })
  })

  it('結算畫面', () => {
    expect(resultSyncStatus('idle', false).text).toBe('這場已存到雲端')
    expect(resultSyncStatus('syncing', true).tone).toBe('busy')
    expect(resultSyncStatus('failed', true).text).toMatch(/尚未同步到雲端.*自動補傳/)
    expect(resultSyncStatus('syncing', false).tone).toBe('ok')
  })
})

describe('資料表的列 → 本機資料', () => {
  it('場次來回轉換後內容相同（毫秒已經是整數時）', () => {
    const original = record('a', 1790000000123, { durationMs: 61235 })
    expect(fromGameRecordRow(toGameRecordRow(original, 'u1'))).toEqual(original)
  })

  it('numeric 欄位以字串回來時也讀得懂', () => {
    const row = { ...toGameRecordRow(record('a', 1790000000000), 'u1'), accuracy: '96.5' }
    expect(fromGameRecordRow(row)?.accuracy).toBe(96.5)
  })

  it('壞掉的列回傳 null', () => {
    expect(fromGameRecordRow(null)).toBeNull()
    expect(fromGameRecordRow({ ...toGameRecordRow(record('a', 1), 'u1'), difficulty: 'nightmare' })).toBeNull()
    expect(fromGameRecordRow({ ...toGameRecordRow(record('a', 1), 'u1'), played_at: 'not a date' })).toBeNull()
  })

  it('最佳紀錄與按鍵統計來回轉換後內容相同，壞掉的列被略過', () => {
    const best = { easy: { score: 3000, wpm: 42, maxCombo: 30, accuracy: 96.5, clears: 2 } }
    expect(fromBestRecordRows([...toBestRecordRows(best, 'u1'), { difficulty: 'weird', score: 1 }, 'x'])).toEqual(best)
    expect(fromBestRecordRows(null)).toEqual({})
    const rows = [stat('a'), stat('a', 't')]
    expect(fromKeyStatDbRows([...rows.map((r) => toKeyStatDbRow(r, 'u1')), { id: 'bad' }, 7])).toEqual(rows)
  })

  it('toCloudSnapshot：場次由舊到新排序，勇者不合法時是 null', () => {
    const snapshot = toCloudSnapshot({
      best: [],
      history: [toGameRecordRow(record('b', 2000), 'u1'), toGameRecordRow(record('a', 1000), 'u1'), { junk: true }],
      keyStats: null,
      hero: 'dragon',
    })
    expect(snapshot.history.map((r) => r.id)).toEqual(['a', 'b'])
    expect(snapshot.keyStats).toEqual([])
    expect(snapshot.hero).toBeNull()
    expect(toCloudSnapshot({ best: [], history: [], keyStats: [], hero: 'panda' }).hero).toBe('panda')
  })
})

describe('本機和雲端合併', () => {
  const best = (score: number, clears: number) => ({ score, wpm: 40, maxCombo: 20, accuracy: 95, clears })
  const empty = { best: {}, history: [], keyStats: [], hero: null }

  it('同一個帳號的最佳紀錄：每一項取較好的，通關次數取較大值而不是相加', () => {
    expect(mergeBestSameAccount({ easy: best(3000, 2) }, { easy: { ...best(2000, 5), wpm: 55 }, hard: best(10, 0) })).toEqual({
      easy: { score: 3000, wpm: 55, maxCombo: 20, accuracy: 95, clears: 5 },
      hard: best(10, 0),
    })
  })

  it('新裝置（本機是空的）：直接得到雲端的內容', () => {
    const cloud = { best: { easy: best(3000, 2) }, history: [record('a', 1), record('b', 2)], keyStats: [stat('a'), stat('b')], hero: null }
    const merged = mergeCloud({ records: { best: {}, history: [] }, keyStats: [], pending: [], bestDirty: false }, cloud)
    expect(merged.records).toEqual({ best: cloud.best, history: cloud.history })
    expect(merged.keyStats).toEqual(cloud.keyStats)
  })

  it('還沒上傳的場次和它的統計會留著，並依時間排在一起', () => {
    const merged = mergeCloud(
      { records: { best: { easy: best(5000, 3) }, history: [record('a', 1), record('new', 9)] }, keyStats: [stat('a'), stat('new')], pending: ['new'], bestDirty: true },
      { best: { easy: best(3000, 2) }, history: [record('a', 1), record('other-device', 5)], keyStats: [stat('a'), stat('other-device')], hero: null },
    )
    expect(merged.records.history.map((r) => r.id)).toEqual(['a', 'other-device', 'new'])
    expect(merged.keyStats.map((k) => k.sessionId).sort()).toEqual(['a', 'new', 'other-device'])
    expect(merged.records.best.easy).toMatchObject({ score: 5000, clears: 3 })
  })

  it('別台裝置清除了紀錄：本機已上傳過的場次、統計和最佳紀錄也跟著清掉', () => {
    const merged = mergeCloud({ records: { best: { easy: best(3000, 2) }, history: [record('a', 1)] }, keyStats: [stat('a')], pending: [], bestDirty: false }, empty)
    expect(merged).toEqual({ records: { best: {}, history: [] }, keyStats: [] })
  })

  it('最多保留最近 30 場', () => {
    const cloud = { ...empty, history: Array.from({ length: 30 }, (_, i) => record(`c${i}`, 100 + i)) }
    const merged = mergeCloud({ records: { best: {}, history: [record('new', 999)] }, keyStats: [], pending: ['new'], bestDirty: false }, cloud)
    expect(merged.records.history).toHaveLength(30)
    expect(merged.records.history.at(-1)?.id).toBe('new')
    expect(merged.records.history[0].id).toBe('c1')
  })
})

describe('訪客資料併入帳號', () => {
  const best = (score: number, clears: number) => ({ score, wpm: 40, maxCombo: 20, accuracy: 95, clears })

  it('訪客沒有資料時不詢問', () => {
    expect(guestMergeOffer({ best: {}, history: [] }, null)).toBeNull()
  })

  it('有戰績時詢問，記號是最新一場的 id', () => {
    expect(guestMergeOffer({ best: {}, history: [record('a', 1), record('b', 2)] }, null)).toEqual({ games: 2, marker: 'b' })
  })

  it('只有最佳紀錄（例如從 1.0 匯入）也會詢問', () => {
    expect(guestMergeOffer({ best: { easy: best(100, 0) }, history: [] }, null)).toEqual({ games: 0, marker: 'best-only' })
  })

  it('同一批資料拒絕過就不再問；訪客又玩了新的一場才會再問', () => {
    const guest = { best: {}, history: [record('a', 1), record('b', 2)] }
    expect(guestMergeOffer(guest, 'b')).toBeNull()
    expect(guestMergeOffer({ ...guest, history: [...guest.history, record('c', 3)] }, 'b')).toEqual({ games: 3, marker: 'c' })
  })

  it('併入：場次依時間排在一起、通關次數相加、統計合在一起', () => {
    const merged = mergeGuest(
      { records: { best: { easy: best(3000, 5) }, history: [record('acc', 5)] }, keyStats: [stat('acc')] },
      { records: { best: { easy: best(4000, 2), hard: best(10, 0) }, history: [record('g1', 1), record('g2', 9)] }, keyStats: [stat('g1'), stat('g2')] },
    )
    expect(merged.records.history.map((r) => r.id)).toEqual(['g1', 'acc', 'g2'])
    expect(merged.records.best).toEqual({ easy: best(4000, 7), hard: best(10, 0) })
    expect(merged.keyStats.map((k) => k.sessionId).sort()).toEqual(['acc', 'g1', 'g2'])
  })

  it('併入兩次（同樣的場次）不會重複', () => {
    const guest = { records: { best: {}, history: [record('g1', 1)] }, keyStats: [stat('g1')] }
    const once = mergeGuest({ records: { best: {}, history: [] }, keyStats: [] }, guest)
    const twice = mergeGuest(once, guest)
    expect(twice.records.history).toHaveLength(1)
    expect(twice.keyStats).toHaveLength(1)
  })
})
