import { useState } from 'react'
import type { Monster, MonsterId, SpriteAnim, TrainingTheme } from '../game/index.ts'
import { monsterImageUrl } from './monsterImages.ts'
import styles from './MonsterSprite.module.css'

export interface MonsterSpriteProps {
  monster: Monster
  /** 正在播的動畫；不給就是待機 */
  anim?: SpriteAnim | null
}

/** 載入失敗過的圖（換動畫時元件會重新建立，記在外面才不會一直重試） */
const failed = new Set<MonsterId>()

/**
 * 怪物的立繪（ROADMAP 6.5）：
 * - 有圖：顯示 AI 生成的圖（512×512、面向左）
 * - 圖還沒放進來：顯示佔位圖
 * - 圖載入失敗：改顯示 emoji，遊戲照常進行
 */
export function MonsterSprite({ monster, anim }: MonsterSpriteProps) {
  const url = monsterImageUrl(monster.id)
  const [broken, setBroken] = useState(() => failed.has(monster.id))
  const classes = [styles.sprite, monster.boss && styles.boss, styles[anim ?? 'idle']]

  let body
  if (url && !broken) {
    const onError = () => {
      failed.add(monster.id)
      setBroken(true)
    }
    body = <img className={styles.image} src={url} alt="" draggable={false} onError={onError} />
  } else if (url) {
    body = <span className={styles.emoji}>{monster.emoji}</span>
  } else {
    body = <MonsterPlaceholder id={monster.id} theme={monster.theme} boss={monster.boss} />
  }
  return (
    <div className={classes.filter(Boolean).join(' ')} role="img" aria-label={monster.name} data-monster={monster.id}>
      {body}
    </div>
  )
}

const THEME_COLOR: Record<TrainingTheme, string> = {
  daily: '#ffd166',
  fantasy: '#b79ced',
  space: '#6fd6b0',
  school: '#ff8fab',
}

/** 圖還沒放進來時的佔位圖：主題色的圓滾滾剪影、面向左（眼睛在左邊）、標上編號，魔王戴皇冠 */
function MonsterPlaceholder({ id, theme, boss }: { id: MonsterId; theme: TrainingTheme; boss: boolean }) {
  const ink = '#4a3550'
  return (
    <svg className={styles.image} viewBox="0 0 512 512" aria-hidden="true" data-placeholder="true">
      {boss && <path d="M176 150 L196 70 L236 120 L256 56 L276 120 L316 70 L336 150 Z" fill="#ffd166" stroke={ink} strokeWidth="14" strokeLinejoin="round" />}
      <path
        d="M96 300 C96 190 170 140 256 140 C350 140 420 196 420 300 C420 380 400 440 256 440 C112 440 96 380 96 300 Z"
        fill={THEME_COLOR[theme]}
        stroke={ink}
        strokeWidth="16"
        strokeLinejoin="round"
      />
      <circle cx="176" cy="270" r="22" fill={ink} />
      <circle cx="256" cy="270" r="22" fill={ink} />
      <circle cx="170" cy="262" r="7" fill="#fff" />
      <circle cx="250" cy="262" r="7" fill="#fff" />
      <path d="M190 330 Q214 350 238 330" fill="none" stroke={ink} strokeWidth="12" strokeLinecap="round" />
      <text x="330" y="400" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="64" fill={ink} opacity="0.55">
        {id.slice(-2)}
      </text>
    </svg>
  )
}
