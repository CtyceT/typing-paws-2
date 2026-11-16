import { useState } from 'react'
import {
  addResult,
  battleResult,
  newRecordKind,
  type BattleResult,
  type BattleState,
  type Difficulty,
  type HeroId,
  type NewRecordKind,
  type Records,
} from './game/index.ts'
import { BattleScreen } from './screens/BattleScreen.tsx'
import { MenuScreen } from './screens/MenuScreen.tsx'
import { ResultScreen } from './screens/ResultScreen.tsx'
import { loadHero, saveHero } from './storage/hero.ts'
import { clearRecords, loadRecords, saveRecords } from './storage/records.ts'

/** battle 的 run 每再挑戰一次就加一，用來重新建立整個戰鬥畫面 */
type Screen =
  | { name: 'menu' }
  | { name: 'battle'; difficulty: Difficulty; run: number }
  | { name: 'result'; result: BattleResult; newRecord: NewRecordKind; run: number }

function App() {
  const [hero, setHero] = useState<HeroId>(loadHero)
  const [records, setRecords] = useState<Records>(loadRecords)
  const [screen, setScreen] = useState<Screen>({ name: 'menu' })

  const selectHero = (next: HeroId) => {
    setHero(next)
    saveHero(next)
  }
  const goMenu = () => setScreen({ name: 'menu' })

  if (screen.name === 'battle') {
    const finish = (state: BattleState) => {
      const result = battleResult(state)
      const playedAt = Date.now()
      const next = addResult(records, result, { id: `${playedAt}-${Math.random().toString(36).slice(2, 8)}`, playedAt })
      setRecords(next)
      saveRecords(next)
      setScreen({ name: 'result', result, newRecord: newRecordKind(records.best[result.difficulty], result), run: screen.run })
    }
    return <BattleScreen key={screen.run} hero={hero} difficulty={screen.difficulty} onExit={goMenu} onFinish={finish} />
  }
  if (screen.name === 'result') {
    const retry = () => setScreen({ name: 'battle', difficulty: screen.result.difficulty, run: screen.run + 1 })
    return <ResultScreen hero={hero} result={screen.result} newRecord={screen.newRecord} onRetry={retry} onMenu={goMenu} />
  }
  return (
    <MenuScreen
      hero={hero}
      records={records}
      onSelectHero={selectHero}
      onStart={(difficulty) => setScreen({ name: 'battle', difficulty, run: 0 })}
      onClearRecords={() => setRecords(clearRecords())}
    />
  )
}

export default App
