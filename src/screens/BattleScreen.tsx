import { useState } from 'react'
import { Button } from '../components/index.ts'
import { createBattle, type Difficulty, type HeroId } from '../game/index.ts'
import { BattleView } from './BattleView.tsx'

export interface BattleScreenProps {
  hero: HeroId
  difficulty: Difficulty
  onExit: () => void
}

/** 戰鬥畫面。目前是靜態版：只顯示開場狀態，還不能打字 */
export function BattleScreen({ hero, difficulty, onExit }: BattleScreenProps) {
  const [state] = useState(() => createBattle(difficulty))
  return (
    <main>
      <BattleView state={state} hero={hero} />
      {/* 暫時的出口，暫停視窗完成後（ROADMAP 1.13）拿掉 */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Button variant="ghost" size="small" onClick={onExit}>
          ← 回選單
        </Button>
      </div>
    </main>
  )
}
