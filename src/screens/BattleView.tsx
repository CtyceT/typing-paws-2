import type { ReactNode } from 'react'
import { Button, Card, FighterInfo, HeroAvatar, MonsterSprite, StatChip, WordDisplay } from '../components/index.ts'
import { battleHud, currentMonster, HEROES, type BattleState, type HeroExpression, type HeroId } from '../game/index.ts'
import styles from './BattleView.module.css'

export interface BattleViewProps {
  state: BattleState
  hero: HeroId
  /** 勇者表情，預設依戰況決定（倒地、勝利、一般） */
  heroExpression?: HeroExpression
  onPause?: () => void
  /** 點競技場或題目面板：把焦點拉回打字輸入框 */
  onRequestFocus?: () => void
  /** 輸入框失去焦點時顯示「點一下這裡繼續打字」 */
  focusLost?: boolean
  /** 題目面板下方的提醒（輸入法、Caps Lock） */
  warning?: ReactNode
  /** 放在題目面板裡的隱藏輸入框 */
  children?: ReactNode
}

/** 戰鬥畫面的版面。只負責把 BattleState 畫出來，計時與輸入都在外面處理 */
export function BattleView({ state, hero, heroExpression, onPause, onRequestFocus, focusLost = false, warning, children }: BattleViewProps) {
  const hud = battleHud(state)
  const monster = currentMonster(state)
  const expression = heroExpression ?? (state.phase === 'lost' ? 'ko' : state.phase === 'won' ? 'happy' : 'normal')
  const monsterDefeated = state.monsterHp <= 0

  return (
    <section>
      <div className={styles.topbar} data-battle="topbar">
        <div className={styles.stagePill}>{hud.stageLabel}</div>
        <div className={styles.topStats}>
          <StatChip label="時間" value={hud.timeText} />
          <StatChip label="WPM" value={hud.wpm} />
          <StatChip label="準確率" value={hud.accuracyText} />
          <StatChip label="分數" value={hud.score} />
        </div>
        <Button variant="ghost" size="small" onClick={onPause}>
          ⏸ 暫停
        </Button>
      </div>

      <div className={styles.arena} data-battle="arena" onClick={onRequestFocus}>
        <div className={styles.cloud} style={{ top: 14, animationDelay: '-4s' }} aria-hidden="true">
          ☁️
        </div>
        <div className={styles.cloud} style={{ top: 56, animationDelay: '-12s', fontSize: 28 }} aria-hidden="true">
          ☁️
        </div>

        <div className={styles.fighter}>
          <FighterInfo side="player" name={`🐾 ${HEROES[hero].name}勇者`} hpText={hud.playerHpText} hpRatio={hud.playerHpRatio} />
          <div className={[styles.heroSprite, expression !== 'ko' && styles.idle].filter(Boolean).join(' ')}>
            <HeroAvatar hero={hero} expression={expression} className={styles.heroSvg} />
          </div>
        </div>

        <div className={styles.vs}>
          <div>
            <div className={styles.comboNum}>{hud.combo}</div>
            <div className={styles.comboLabel}>COMBO</div>
          </div>
          <div className={[styles.mult, styles[hud.multiplierTone]].join(' ')}>{hud.multiplierText}</div>
        </div>

        <div className={styles.fighter}>
          <FighterInfo
            side="monster"
            name={monster.name}
            hpText={hud.monsterHpText}
            hpRatio={hud.monsterHpRatio}
            charge={{ ratio: hud.chargeRatio, text: hud.chargeText, danger: hud.chargeDanger }}
          />
          <MonsterSprite monster={monster} defeated={monsterDefeated} />
        </div>
      </div>

      <Card className={styles.wordPanel} data-battle="word-panel" onClick={onRequestFocus}>
        <div className={styles.wordHint}>輸入下面的字來攻擊！（大小寫、空白與標點都要正確）</div>
        <WordDisplay chars={hud.chars} />
        <div className={styles.nextWords}>
          <span className={styles.nextLabel}>下一個 →</span>
          {hud.preview.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        {focusLost && <div className={styles.focusWarn}>👆 點一下這裡繼續打字</div>}
        {warning && (
          <div className={styles.warning} role="alert">
            {warning}
          </div>
        )}
        {children}
      </Card>
    </section>
  )
}
