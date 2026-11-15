import type { Monster, SpriteAnim } from '../game/index.ts'
import styles from './MonsterSprite.module.css'

export interface MonsterSpriteProps {
  monster: Monster
  /** 正在播的動畫；不給就是待機 */
  anim?: SpriteAnim | null
}

/**
 * 怪物的圖。目前畫 emoji；之後換成 AI 生成的立繪（ROADMAP 6.5）時只需要改這個元件。
 */
export function MonsterSprite({ monster, anim }: MonsterSpriteProps) {
  const classes = [styles.sprite, monster.boss && styles.boss, styles[anim ?? 'idle']]
  return (
    <div className={classes.filter(Boolean).join(' ')} role="img" aria-label={monster.name}>
      {monster.emoji}
    </div>
  )
}
