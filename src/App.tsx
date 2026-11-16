import { useState } from 'react'
import {
  addResult,
  battleResult,
  HEROES,
  mergeRecords,
  newRecordKind,
  summarizeSession,
  type BattleResult,
  type BattleState,
  type Difficulty,
  type HeroId,
  type LegacyImport,
  type NewRecordKind,
  type Records,
} from './game/index.ts'
import { MessageDialog } from './components/index.ts'
import { BattleScreen } from './screens/BattleScreen.tsx'
import { MenuScreen } from './screens/MenuScreen.tsx'
import { ResultScreen } from './screens/ResultScreen.tsx'
import { loadHero, saveHero } from './storage/hero.ts'
import { localKeyStatsStore as keyStatsStore } from './storage/keyStats.ts'
import { findLegacyImport, markLegacyAsked } from './storage/legacy.ts'
import { clearRecords, loadRecords, saveRecords } from './storage/records.ts'

/** battle 的 run 每再挑戰一次就加一，用來重新建立整個戰鬥畫面 */
type Screen =
  | { name: 'menu' }
  | { name: 'battle'; difficulty: Difficulty; run: number }
  | { name: 'result'; result: BattleResult; newRecord: NewRecordKind; run: number }

/** 匯入詢問視窗的內文：列出找到了什麼 */
function legacySummary(legacy: LegacyImport): string {
  const found = [
    legacy.hero && `勇者「${HEROES[legacy.hero].name}」`,
    legacy.records.history.length > 0 && `${legacy.records.history.length} 場戰績`,
    Object.keys(legacy.records.best).length > 0 && '最佳紀錄',
  ].filter(Boolean)
  return `找到 ${found.join('、')}，\n要匯入到 2.0 嗎？1.0 的紀錄不會被更動。`
}

function App() {
  const [hero, setHero] = useState<HeroId>(loadHero)
  const [records, setRecords] = useState<Records>(loadRecords)
  const [screen, setScreen] = useState<Screen>({ name: 'menu' })
  /** 等使用者決定要不要匯入的 1.0 舊紀錄；沒有或已經問過是 null */
  const [legacy, setLegacy] = useState<LegacyImport | null>(findLegacyImport)

  const selectHero = (next: HeroId) => {
    setHero(next)
    saveHero(next)
  }
  const goMenu = () => setScreen({ name: 'menu' })
  const answerLegacy = (answer: 'imported' | 'skipped') => {
    if (legacy && answer === 'imported') {
      const next = mergeRecords(records, legacy.records)
      setRecords(next)
      saveRecords(next)
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
      saveRecords(next)
      keyStatsStore.saveSession(summarizeSession(state.keyLog, { sessionId: id, playedAt }))
      setScreen({ name: 'result', result, newRecord: newRecordKind(records.best[result.difficulty], result), run: screen.run })
    }
    return <BattleScreen key={screen.run} hero={hero} difficulty={screen.difficulty} onExit={goMenu} onFinish={finish} />
  }
  if (screen.name === 'result') {
    const retry = () => setScreen({ name: 'battle', difficulty: screen.result.difficulty, run: screen.run + 1 })
    return <ResultScreen hero={hero} result={screen.result} newRecord={screen.newRecord} onRetry={retry} onMenu={goMenu} />
  }
  return (
    <>
      <MenuScreen
        hero={hero}
        records={records}
        onSelectHero={selectHero}
        onStart={(difficulty) => setScreen({ name: 'battle', difficulty, run: 0 })}
        onClearRecords={() => {
          setRecords(clearRecords())
          keyStatsStore.clear()
        }}
      />
      {legacy && (
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
