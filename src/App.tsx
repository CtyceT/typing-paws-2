import { useState } from 'react'
import type { Difficulty, HeroId } from './game/index.ts'
import { BattlePlaceholder } from './screens/BattlePlaceholder.tsx'
import { MenuScreen } from './screens/MenuScreen.tsx'
import { loadHero, saveHero } from './storage/hero.ts'

type Screen = { name: 'menu' } | { name: 'battle'; difficulty: Difficulty }

function App() {
  const [hero, setHero] = useState<HeroId>(loadHero)
  const [screen, setScreen] = useState<Screen>({ name: 'menu' })

  const selectHero = (next: HeroId) => {
    setHero(next)
    saveHero(next)
  }

  if (screen.name === 'battle') {
    return <BattlePlaceholder hero={hero} difficulty={screen.difficulty} onExit={() => setScreen({ name: 'menu' })} />
  }
  return (
    <MenuScreen hero={hero} onSelectHero={selectHero} onStart={(difficulty) => setScreen({ name: 'battle', difficulty })} />
  )
}

export default App
