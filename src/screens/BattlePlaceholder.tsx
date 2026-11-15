import { Button, Card, HeroAvatar } from '../components/index.ts'
import { DIFFICULTIES, HEROES, type Difficulty, type HeroId } from '../game/index.ts'
import styles from './BattlePlaceholder.module.css'

export interface BattlePlaceholderProps {
  hero: HeroId
  difficulty: Difficulty
  onExit: () => void
}

/** 戰鬥畫面的暫時佔位（ROADMAP 1.10 會換成真正的戰鬥畫面） */
export function BattlePlaceholder({ hero, difficulty, onExit }: BattlePlaceholderProps) {
  const d = DIFFICULTIES[difficulty]
  return (
    <main>
      <Card className={styles.card}>
        <HeroAvatar hero={hero} className={styles.avatar} />
        <h1 className={styles.title}>戰鬥畫面施工中 🚧</h1>
        <p className={styles.text}>
          {HEROES[hero].name}勇者準備挑戰「{d.icon} {d.label}」難度
        </p>
        <Button variant="ghost" onClick={onExit}>
          ← 回選單
        </Button>
      </Card>
    </main>
  )
}
