import { useEffect, useState } from 'react'
import {
  addResult,
  battleResult,
  HEROES,
  mergeRecords,
  newRecordKind,
  sessionMisses,
  summarizeSession,
  type BattleResult,
  type BattleState,
  type Difficulty,
  type HeroId,
  type KeyStatRow,
  type LegacyImport,
  type NewRecordKind,
  type Records,
  type SessionMiss,
} from './game/index.ts'
import { AUTH_PROVIDERS, authErrorFromUrl, authRedirectUrl, defaultCloud, PROVIDER_LABELS, useAuth, type AuthProvider, type AuthUser, type Cloud } from './cloud/index.ts'
import { AccountBar, MessageDialog } from './components/index.ts'
import { BattleScreen } from './screens/BattleScreen.tsx'
import { DashboardScreen } from './screens/DashboardScreen.tsx'
import { MenuScreen } from './screens/MenuScreen.tsx'
import { ResultScreen } from './screens/ResultScreen.tsx'
import { loadHero, saveHero } from './storage/hero.ts'
import { createLocalKeyStatsStore } from './storage/keyStats.ts'
import { findLegacyImport, markLegacyAsked } from './storage/legacy.ts'
import { clearRecords, loadRecords, saveRecords } from './storage/records.ts'

/** battle 的 run 每再挑戰一次就加一，用來重新建立整個戰鬥畫面 */
type Screen =
  | { name: 'menu' }
  | { name: 'dashboard' }
  | { name: 'battle'; difficulty: Difficulty; run: number }
  | { name: 'result'; result: BattleResult; newRecord: NewRecordKind; misses: SessionMiss[]; run: number }

/** 匯入詢問視窗的內文：列出找到了什麼 */
function legacySummary(legacy: LegacyImport): string {
  const found = [
    legacy.hero && `勇者「${HEROES[legacy.hero].name}」`,
    legacy.records.history.length > 0 && `${legacy.records.history.length} 場戰績`,
    Object.keys(legacy.records.best).length > 0 && '最佳紀錄',
  ].filter(Boolean)
  return `找到 ${found.join('、')}，\n要匯入到 2.0 嗎？1.0 的紀錄不會被更動。`
}

export interface AppProps {
  /** 雲端功能（登入）；沒給就用環境變數設定的 Supabase 專案，null 表示只有訪客模式。測試時可以換成假的 */
  cloud?: Cloud | null
}

/** 最外層：先確定登入狀態，再顯示遊戲。換帳號（登入、登出）時整個遊戲重新建立，回到主選單 */
function App({ cloud = defaultCloud }: AppProps) {
  const auth = useAuth(cloud?.auth ?? null)
  if (auth.status === 'loading') {
    return (
      <main className="app-loading" role="status">
        🐾 載入中…
      </main>
    )
  }
  return <Game key={auth.user?.id ?? 'guest'} user={auth.user} cloud={cloud} />
}

interface GameProps {
  /** 登入的人；null 是訪客 */
  user: AuthUser | null
  cloud: Cloud | null
}

function Game({ user, cloud }: GameProps) {
  /** 這份資料屬於誰：訪客和每個帳號在這個瀏覽器裡各有一份，互不混用 */
  const scope = user?.id ?? null
  const [keyStatsStore] = useState(() => createLocalKeyStatsStore(scope))
  const [hero, setHero] = useState<HeroId>(() => loadHero(scope))
  const [records, setRecords] = useState<Records>(() => loadRecords(scope))
  const [keyStats, setKeyStats] = useState<KeyStatRow[]>(() => keyStatsStore.load())
  const [screen, setScreen] = useState<Screen>({ name: 'menu' })
  /** 等使用者決定要不要匯入的 1.0 舊紀錄；沒有或已經問過是 null */
  const [legacy, setLegacy] = useState<LegacyImport | null>(findLegacyImport)
  /** 登入視窗：closed 關著、open 開著、其他字串是要顯示的錯誤說明 */
  const [signIn, setSignIn] = useState<'closed' | 'open' | { error: string }>(() => {
    const error = user ? null : authErrorFromUrl(window.location.search, window.location.hash)
    return error ? { error } : 'closed'
  })

  // 登入失敗被導回來時，網址上會留著 error 參數：顯示過一次就清掉，重新整理才不會再跳出來
  useEffect(() => {
    if (authErrorFromUrl(window.location.search, window.location.hash)) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const startSignIn = (provider: AuthProvider) => {
    if (!cloud) return
    cloud.auth.signIn(provider, authRedirectUrl(window.location.origin, import.meta.env.BASE_URL)).catch(() => {
      setSignIn({ error: '連不上登入服務，請確認網路後再試一次。' })
    })
  }
  const signOut = () => {
    cloud?.auth.signOut().catch(() => {
      // 登出失敗（極少見）：維持登入狀態，玩家可以再按一次
    })
  }

  const selectHero = (next: HeroId) => {
    setHero(next)
    saveHero(next, scope)
  }
  const goMenu = () => setScreen({ name: 'menu' })
  const answerLegacy = (answer: 'imported' | 'skipped') => {
    if (legacy && answer === 'imported') {
      const next = mergeRecords(records, legacy.records)
      setRecords(next)
      saveRecords(next, scope)
      if (legacy.hero) selectHero(legacy.hero)
    }
    markLegacyAsked(answer)
    setLegacy(null)
  }

  if (screen.name === 'battle') {
    const finish = (state: BattleState) => {
      const result = battleResult(state)
      const playedAt = Date.now()
      const id = `${playedAt}-${Math.random().toString(36).slice(2, 8)}`
      const next = addResult(records, result, { id, playedAt })
      setRecords(next)
      saveRecords(next, scope)
      const sessionStats = summarizeSession(state.keyLog, { sessionId: id, playedAt })
      setKeyStats(keyStatsStore.saveSession(sessionStats))
      setScreen({ name: 'result', result, newRecord: newRecordKind(records.best[result.difficulty], result), misses: sessionMisses(sessionStats), run: screen.run })
    }
    return <BattleScreen key={screen.run} hero={hero} difficulty={screen.difficulty} onExit={goMenu} onFinish={finish} />
  }
  if (screen.name === 'result') {
    const retry = () => setScreen({ name: 'battle', difficulty: screen.result.difficulty, run: screen.run + 1 })
    return (
      <ResultScreen
        hero={hero}
        result={screen.result}
        newRecord={screen.newRecord}
        misses={screen.misses}
        onDashboard={() => setScreen({ name: 'dashboard' })}
        onRetry={retry}
        onMenu={goMenu}
      />
    )
  }
  if (screen.name === 'dashboard') {
    return <DashboardScreen records={records} keyStats={keyStats} signedIn={user !== null} onBack={goMenu} />
  }
  return (
    <>
      <MenuScreen
        hero={hero}
        records={records}
        signedIn={user !== null}
        onSelectHero={selectHero}
        onStart={(difficulty) => setScreen({ name: 'battle', difficulty, run: 0 })}
        onOpenDashboard={() => setScreen({ name: 'dashboard' })}
        accountBar={<AccountBar user={user} onSignIn={cloud ? () => setSignIn('open') : undefined} onSignOut={signOut} />}
        onClearRecords={() => {
          setRecords(clearRecords(scope))
          keyStatsStore.clear()
          setKeyStats([])
        }}
      />
      <MessageDialog
        open={signIn !== 'closed'}
        emoji={signIn === 'open' ? '🔑' : '😿'}
        title={signIn === 'open' ? '登入喵喵打字' : '登入沒有成功'}
        text={
          signIn === 'open' || signIn === 'closed'
            ? '登入後，戰績和按鍵統計會存到雲端，\n換一台裝置也看得到。\n不登入也可以完整遊玩，紀錄只存在這個瀏覽器。'
            : `${signIn.error}\n可以再試一次，或先用訪客身分玩。`
        }
        buttons={[
          ...AUTH_PROVIDERS.map((provider, i) => ({
            label: `用 ${PROVIDER_LABELS[provider]} 登入${i === 0 ? '（Enter）' : ''}`,
            primary: i === 0,
            onClick: () => startSignIn(provider),
          })),
          { label: '先當訪客', onClick: () => setSignIn('closed') },
        ]}
      />
      {legacy && signIn === 'closed' && (
        <MessageDialog
          open
          emoji="📦"
          title="發現 1.0 版的舊紀錄"
          text={legacySummary(legacy)}
          buttons={[
            { label: '📥 匯入（Enter）', primary: true, onClick: () => answerLegacy('imported') },
            { label: '略過', onClick: () => answerLegacy('skipped') },
          ]}
        />
      )}
    </>
  )
}

export default App
