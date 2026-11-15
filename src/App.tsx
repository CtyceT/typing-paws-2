import { useState } from 'react'
import type { Difficulty, HeroId } from './game/index.ts'
import { BattleScreen } from './screens/BattleScreen.tsx'
import { MenuScreen } from './screens/MenuScreen.tsx'
import { loadHero, saveHero } from './storage/hero.ts'

/** battle 的 run 每再挑戰一次就加一，用來重新建立整個戰鬥畫面 */
type Screen = { name: 'menu' } | { name: 'battle'; difficulty: Difficulty; run: number }

function App() {
  const [hero, setHero] = useState<HeroId>(loadHero)
  const [screen, setScreen] = useState<Screen>({ name: 'menu' })

  const selectHero = (next: HeroId) => {
    setHero(next)
    saveHero(next)
  }

  if (screen.name === 'battle') {
    return (
      <BattleScreen
        key={screen.run}
        hero={hero}
        difficulty={screen.difficulty}
        onExit={() => setScreen({ name: 'menu' })}
        onRetry={() => setScreen({ ...screen, run: screen.run + 1 })}
      />
    )
  }
  return (
    <MenuScreen hero={hero} onSelectHero={selectHero} onStart={(difficulty) => setScreen({ name: 'battle', difficulty, run: 0 })} />
  )
}

export default App
