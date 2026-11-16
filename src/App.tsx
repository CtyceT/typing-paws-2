import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  aggregateKeyStats,
  battleResult,
  DEFAULT_THEME,
  DIFFICULTY_ORDER,
  HEROES,
  planTraining,
  resultSyncStatus,
  summarizeSession,
  syncStatus,
  trainingFeedback,
  type BattleResult,
  type BattleState,
  type Difficulty,
  type GameMode,
  type LegacyImport,
  type NewRecordKind,
  type SessionMiss,
  type TrainingFeedbackRow,
  type TrainingPlan,
  type TrainingTarget,
  type TrainingTheme,
} from './game/index.ts'
import { AUTH_PROVIDERS, authErrorFromUrl, authRedirectUrl, defaultCloud, PROVIDER_LABELS, useAuth, type AuthProvider, type AuthUser, type Cloud } from './cloud/index.ts'
import { AccountBar, MessageDialog } from './components/index.ts'
import { BattleScreen } from './screens/BattleScreen.tsx'
import { MenuScreen } from './screens/MenuScreen.tsx'
import { ResultScreen } from './screens/ResultScreen.tsx'
import { TrainingLoadingScreen } from './screens/TrainingLoadingScreen.tsx'
import { findLegacyImport, markLegacyAsked } from './storage/legacy.ts'
import { usePlayerData } from './sync/usePlayerData.ts'
import { loadTrainingWords, type TrainingWords } from './training/loadTrainingWords.ts'

/** 儀表板（熱力圖、趨勢圖、弱點排行）點進去才下載，首頁不用先載入（ROADMAP 11.5） */
const DashboardScreen = lazy(() => import('./screens/DashboardScreen.tsx').then((m) => ({ default: m.DashboardScreen })))

/** 一場弱點特訓：要練的鍵、主題、題目。再挑戰一次時沿用同一份題目，不會再請 AI 出題 */
interface TrainingSession {
  targets: readonly TrainingTarget[]
  theme: TrainingTheme
  words: TrainingWords
}

/** battle 的 run 每再挑戰一次就加一，用來重新建立整個戰鬥畫面 */
type Screen =
  | { name: 'menu' }
  | { name: 'dashboard' }
  | { name: 'training-loading'; difficulty: Difficulty; targets: readonly TrainingTarget[]; theme: TrainingTheme; loading: Promise<TrainingWords>; cancel: () => void }
  | { name: 'battle'; difficulty: Difficulty; run: number; training?: TrainingSession }
  | {
      name: 'result'
      id: string
      result: BattleResult
      newRecord: NewRecordKind
      misses: SessionMiss[]
      run: number
      training?: TrainingSession & { rows: TrainingFeedbackRow[] }
    }

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
  /** 這個帳號的雲端資料；訪客或沒有雲端功能時是 null（換帳號時整個 Game 會重新建立，所以只需要建立一次） */
  const [cloudData] = useState(() => (user && cloud ? cloud.data(user.id) : null))
  // 訪客和每個帳號在這個瀏覽器裡各有一份資料，互不混用
  const player = usePlayerData(user?.id ?? null, cloudData)
  const { hero, records, keyStats } = player
  const signedIn = user !== null
  /** 清除紀錄時雲端刪除失敗 */
  const [clearFailed, setClearFailed] = useState(false)
  /** 訪客紀錄併入帳號時上傳失敗 */
  const [guestMergeFailed, setGuestMergeFailed] = useState(false)
  const answerGuest = (accept: boolean) => void player.answerGuestOffer(accept).then((ok) => setGuestMergeFailed(!ok))
  const [screen, setScreen] = useState<Screen>({ name: 'menu' })
  /** 主選單上選中的模式與特訓主題（回到選單時還記得） */
  const [mode, setMode] = useState<GameMode>('classic')
  const [theme, setTheme] = useState<TrainingTheme>(DEFAULT_THEME)
  /** 每個難度的特訓要練哪些鍵 */
  const plans = useMemo(() => {
    const aggregates = aggregateKeyStats(keyStats)
    return Object.fromEntries(DIFFICULTY_ORDER.map((d) => [d, planTraining(aggregates, d)])) as Record<Difficulty, TrainingPlan>
  }, [keyStats])
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

  const goMenu = () => setScreen({ name: 'menu' })
  /** 請 AI 出題（只有登入時可以；失敗會自動退回內建字庫），同時切到「出題中」的畫面 */
  const startTraining = (difficulty: Difficulty) => {
    const plan = plans[difficulty]
    if (plan.status !== 'ready') return
    const controller = new AbortController()
    const request = { difficulty, theme, weaknesses: plan.targets.map((t) => t.key) }
    const loading = loadTrainingWords(user && cloud ? cloud.training : null, request, { signal: controller.signal })
    setScreen({ name: 'training-loading', difficulty, targets: plan.targets, theme, loading, cancel: () => controller.abort() })
  }
  const trainingReady = useCallback((words: TrainingWords) => {
    setScreen((current) =>
      current.name === 'training-loading' ? { name: 'battle', difficulty: current.difficulty, run: 0, training: { targets: current.targets, theme: current.theme, words } } : current,
    )
  }, [])
  const answerLegacy = (answer: 'imported' | 'skipped') => {
    if (legacy && answer === 'imported') {
      player.importRecords(legacy.records)
      if (legacy.hero) player.selectHero(legacy.hero)
    }
    markLegacyAsked(answer)
    setLegacy(null)
  }

  if (screen.name === 'training-loading') {
    const cancel = () => {
      screen.cancel()
      goMenu()
    }
    return <TrainingLoadingScreen targets={screen.targets} theme={screen.theme} loading={screen.loading} onReady={trainingReady} onCancel={cancel} />
  }
  if (screen.name === 'battle') {
    const { training } = screen
    const finish = (state: BattleState) => {
      const result = battleResult(state)
      // 特訓成效要和「這一場之前」的統計比，所以在存檔之前先算好
      const rows = training && trainingFeedback(training.targets, summarizeSession(state.keyLog, { sessionId: 'feedback', playedAt: 0 }), aggregateKeyStats(keyStats))
      const saved = player.addGame(result, state.keyLog, training ? 'training' : 'classic')
      setScreen({ name: 'result', result, ...saved, run: screen.run, ...(training && rows && { training: { ...training, rows } }) })
    }
    return <BattleScreen key={screen.run} hero={hero} difficulty={screen.difficulty} words={training?.words.words} onExit={goMenu} onFinish={finish} />
  }
  if (screen.name === 'result') {
    const { training } = screen
    const retry = () =>
      setScreen({
        name: 'battle',
        difficulty: screen.result.difficulty,
        run: screen.run + 1,
        ...(training && { training: { targets: training.targets, theme: training.theme, words: training.words } }),
      })
    return (
      <ResultScreen
        hero={hero}
        result={screen.result}
        newRecord={screen.newRecord}
        misses={screen.misses}
        training={training && { rows: training.rows, source: training.words.source }}
        sync={cloudData ? resultSyncStatus(player.phase, player.pending.includes(screen.id)) : undefined}
        onDashboard={() => setScreen({ name: 'dashboard' })}
        onRetry={retry}
        onMenu={goMenu}
      />
    )
  }
  if (screen.name === 'dashboard') {
    return (
      <Suspense
        fallback={
          <main className="app-loading" role="status">
            🐾 載入中…
          </main>
        }
      >
        <DashboardScreen records={records} keyStats={keyStats} signedIn={signedIn} onBack={goMenu} />
      </Suspense>
    )
  }
  return (
    <>
      <MenuScreen
        hero={hero}
        records={records}
        signedIn={signedIn}
        onSelectHero={player.selectHero}
        mode={mode}
        onSelectMode={setMode}
        training={{ plans, theme, onSelectTheme: setTheme, onStart: startTraining, onSignIn: cloud ? () => setSignIn('open') : undefined }}
        onStart={(difficulty) => setScreen({ name: 'battle', difficulty, run: 0 })}
        onOpenDashboard={() => setScreen({ name: 'dashboard' })}
        accountBar={
          <AccountBar
            user={user}
            onSignIn={cloud ? () => setSignIn('open') : undefined}
            onSignOut={signOut}
            sync={cloudData ? syncStatus(player.phase, player.pending.length) : undefined}
            onRetrySync={player.retrySync}
          />
        }
        onClearRecords={() => void player.clearAll().then((ok) => setClearFailed(!ok))}
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
      <MessageDialog
        open={clearFailed}
        emoji="😿"
        title="清除沒有成功"
        text={'連不上雲端，所以紀錄都還在。\n請確認網路後再試一次。'}
        buttons={[{ label: '知道了（Enter）', primary: true, onClick: () => setClearFailed(false) }]}
      />
      <MessageDialog
        open={player.guestOffer !== null && !legacy}
        emoji="🎒"
        title="要把訪客紀錄併入帳號嗎？"
        text={`這個瀏覽器有${player.guestOffer?.games ? ` ${player.guestOffer.games} 場` : ''}還沒登入時留下的紀錄。\n併入後會存到「${user?.name ?? ''}」的帳號，並從訪客紀錄移走；\n選「先不要」的話，它們會原封不動留在訪客模式。`}
        buttons={[
          { label: '📥 併入帳號（Enter）', primary: true, onClick: () => answerGuest(true) },
          { label: '先不要', onClick: () => answerGuest(false) },
        ]}
      />
      <MessageDialog
        open={guestMergeFailed}
        emoji="😿"
        title="併入沒有成功"
        text={'連不上雲端，訪客紀錄都還在原本的地方。\n下次登入時會再問你一次。'}
        buttons={[{ label: '知道了（Enter）', primary: true, onClick: () => setGuestMergeFailed(false) }]}
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
