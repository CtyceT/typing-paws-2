import type { Monster } from '../game/index.ts'
import styles from './MonsterSprite.module.css'

export interface MonsterSpriteProps {
  monster: Monster
  /** 已經被打倒 */
  defeated?: boolean
}

/**
 * 怪物的圖。目前畫 emoji；之後換成 AI 生成的立繪（ROADMAP 6.5）時只需要改這個元件。
 */
export function MonsterSprite({ monster, defeated = false }: MonsterSpriteProps) {
  const classes = [styles.sprite, monster.boss && styles.boss, defeated ? styles.defeated : styles.idle]
  return (
    <div className={classes.filter(Boolean).join(' ')} role="img" aria-label={monster.name}>
      {monster.emoji}
    </div>
  )
}
