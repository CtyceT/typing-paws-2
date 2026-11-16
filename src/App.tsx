import { useEffect, useState } from 'react'
import {
  battleResult,
  HEROES,
  resultSyncStatus,
  syncStatus,
  type BattleResult,
  type BattleState,
  type Difficulty,
  type LegacyImport,
  type NewRecordKind,
  type SessionMiss,
} from './game/index.ts'
import { AUTH_PROVIDERS, authErrorFromUrl, authRedirectUrl, defaultCloud, PROVIDER_LABELS, useAuth, type AuthProvider, type AuthUser, type Cloud } from './cloud/index.ts'
import { AccountBar, MessageDialog } from './components/index.ts'
import { BattleScreen } from './screens/BattleScreen.tsx'
import { DashboardScreen } from './screens/DashboardScreen.tsx'
import { MenuScreen } from './screens/MenuScreen.tsx'
import { ResultScreen } from './screens/ResultScreen.tsx'
import { findLegacyImport, markLegacyAsked } from './storage/legacy.ts'
import { usePlayerData } from './sync/usePlayerData.ts'

/** battle 的 run 每再挑戰一次就加一，用來重新建立整個戰鬥畫面 */
type Screen =
  | { name: 'menu' }
  | { name: 'dashboard' }
  | { name: 'battle'; difficulty: Difficulty; run: number }
  | { name: 'result'; id: string; result: BattleResult; newRecord: NewRecordKind; misses: SessionMiss[]; run: number }

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
  const answerLegacy = (answer: 'imported' | 'skipped') => {
    if (legacy && answer === 'imported') {
      player.importRecords(legacy.records)
      if (legacy.hero) player.selectHero(legacy.hero)
    }
    markLegacyAsked(answer)
    setLegacy(null)
  }

  if (screen.name === 'battle') {
    const finish = (state: BattleState) => {
      const result = battleResult(state)
      const saved = player.addGame(result, state.keyLog)
      setScreen({ name: 'result', result, ...saved, run: screen.run })
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
        sync={cloudData ? resultSyncStatus(player.phase, player.pending.includes(screen.id)) : undefined}
        onDashboard={() => setScreen({ name: 'dashboard' })}
        onRetry={retry}
        onMenu={goMenu}
      />
    )
  }
  if (screen.name === 'dashboard') {
    return <DashboardScreen records={records} keyStats={keyStats} signedIn={signedIn} onBack={goMenu} />
  }
  return (
    <>
      <MenuScreen
        hero={hero}
        records={records}
        signedIn={signedIn}
        onSelectHero={player.selectHero}
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
