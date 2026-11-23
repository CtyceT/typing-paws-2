import type { CSSProperties, ReactNode } from 'react'
import { Button, Card, FighterInfo, HeroAvatar, Icon, MonsterSprite, ParticleShape, StatChip, WordDisplay } from '../components/index.ts'
import {
  battleHud,
  currentMonster,
  HEROES,
  type BattleState,
  type EffectTarget,
  type HeroExpression,
  type HeroId,
  type SpriteAnim,
} from '../game/index.ts'
import type { BattleEffects } from './useBattleEffects.ts'
import styles from './BattleView.module.css'

/** 勇者動畫對應的表情：衝出去是開心、被打是受傷、倒地是倒地 */
const HERO_EXPRESSION: Partial<Record<SpriteAnim | 'idle', HeroExpression>> = { attack: 'happy', hit: 'hurt', ko: 'ko' }

/** 競技場天空飄的雲（裝飾，用 SVG 畫，取代 1.0 版的 emoji 雲） */
function Cloud({ style }: { style: CSSProperties }) {
  return (
    <svg className={styles.cloud} style={style} viewBox="0 0 48 30" width="1.6em" height="1em" aria-hidden="true">
      <path
        d="M12 27h25a8 8 0 0 0 1-15.9A11 11 0 0 0 17.3 8 8.5 8.5 0 0 0 4 15a6 6 0 0 0 8 12z"
        fill="#fff"
        stroke="#8ecdf6"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 讓同一個 CSS 動畫可以重播：次數是奇數和偶數時用不同名字的 keyframes（內容相同） */
const replay = (count: number | undefined, a: string, b: string) => (count ? (count % 2 ? a : b) : '')

export interface BattleViewProps {
  state: BattleState
  hero: HeroId
  /** 正在播的特效；不給就只依戰況顯示靜態畫面（展示頁用） */
  effects?: BattleEffects
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
export function BattleView({ state, hero, effects, onPause, onRequestFocus, focusLost = false, warning, children }: BattleViewProps) {
  const hud = battleHud(state)
  const monster = currentMonster(state)
  // 沒有特效資料時，倒地狀態直接看戰況
  const heroAnim: SpriteAnim | null = effects ? (effects.heroAnim?.anim ?? null) : state.phase === 'lost' ? 'ko' : null
  const monsterAnim: SpriteAnim | null = effects ? (effects.monsterAnim?.anim ?? null) : state.monsterHp <= 0 ? 'ko' : null
  const expression = HERO_EXPRESSION[heroAnim ?? 'idle'] ?? (state.phase === 'won' ? 'happy' : 'normal')
  const shakes = effects?.shakes

  /** 某個位置上的傷害數字與粒子 */
  const overlay = (target: EffectTarget) => (
    <>
      {effects?.floats
        .filter((f) => f.target === target)
        .map((f) => (
          <div key={f.id} className={[styles.float, styles[f.tone]].join(' ')} style={{ left: `calc(50% + ${f.offsetX}px)` }}>
            {f.text}
          </div>
        ))}
      {effects?.particles
        .filter((p) => p.target === target)
        .map((p) => (
          <div key={p.id} className={styles.particle} style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px` } as CSSProperties} aria-hidden="true">
            <ParticleShape shape={p.shape} color={p.color} />
          </div>
        ))}
    </>
  )

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
          <Icon name="pause" /> 暫停
        </Button>
      </div>

      <div className={[styles.arena, replay(shakes?.arena, styles.shakeA, styles.shakeB)].join(' ')} data-battle="arena" onClick={onRequestFocus}>
        <Cloud style={{ top: 14, animationDelay: '-4s' }} />
        <Cloud style={{ top: 56, animationDelay: '-12s', fontSize: 28 }} />

        <div className={styles.fighter}>
          <FighterInfo side="player" name={`${HEROES[hero].name}勇者`}
            icon="paw" hpText={hud.playerHpText} hpRatio={hud.playerHpRatio} />
          <div className={styles.spriteBox}>
            {/* key 讓同一個動畫連續觸發時可以重播 */}
            <div key={effects?.heroAnim?.id ?? 0} className={[styles.heroSprite, styles[heroAnim ?? 'idle']].join(' ')} data-anim={heroAnim ?? 'idle'}>
              <HeroAvatar hero={hero} expression={expression} className={styles.heroSvg} />
            </div>
            {overlay('hero')}
          </div>
        </div>

        <div className={styles.vs}>
          <div>
            <div className={[styles.comboNum, replay(shakes?.combo, styles.bumpA, styles.bumpB)].join(' ')}>{hud.combo}</div>
            <div className={styles.comboLabel}>COMBO</div>
          </div>
          <div className={[styles.mult, styles[hud.multiplierTone]].join(' ')}>{hud.multiplierText}</div>
          {overlay('combo')}
        </div>

        <div className={styles.fighter}>
          <FighterInfo
            side="monster"
            name={monster.name}
            hpText={hud.monsterHpText}
            hpRatio={hud.monsterHpRatio}
            charge={{ ratio: hud.chargeRatio, text: hud.chargeText, danger: hud.chargeDanger }}
          />
          <div className={styles.spriteBox} data-anim={monsterAnim ?? 'idle'}>
            <MonsterSprite key={effects?.monsterAnim?.id ?? 0} monster={monster} anim={monsterAnim} />
            {overlay('monster')}
          </div>
        </div>
      </div>

      <Card className={styles.wordPanel} data-battle="word-panel" onClick={onRequestFocus}>
        <div className={styles.wordHint}>輸入下面的字來攻擊！（大小寫、空白與標點都要正確）</div>
        <div className={replay(shakes?.word, styles.wordShakeA, styles.wordShakeB)}>
          <WordDisplay chars={hud.chars} />
        </div>
        <div className={styles.nextWords}>
          <span className={styles.nextLabel}>下一個 →</span>
          {hud.preview.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        {focusLost && <div className={styles.focusWarn}>
            <Icon name="pointer" /> 點一下這裡繼續打字
          </div>}
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
