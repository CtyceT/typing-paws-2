import type { IconName } from '../game/index.ts'
import { ProgressBar } from './ProgressBar.tsx'
import styles from './FighterInfo.module.css'
import { Icon } from './Icon.tsx'

export interface FighterInfoProps {
  name: string
  /** 名字前面的小圖示 */
  icon?: IconName
  /** 例如 "100/100" */
  hpText: string
  /** 血量比例 0～1 */
  hpRatio: number
  side: 'player' | 'monster'
  /** 怪物才有的蓄力條 */
  charge?: { ratio: number; text: string; danger: boolean }
}

/** 競技場上的資訊框：名字、血量、血條，怪物多一條蓄力條 */
export function FighterInfo({ name, icon, hpText, hpRatio, side, charge }: FighterInfoProps) {
  return (
    <div className={styles.info}>
      <div className={styles.name}>
        <span>
          {icon && <Icon name={icon} tone="pink" />} {name}
        </span>
        <span>{hpText}</span>
      </div>
      <ProgressBar tone={side} value={hpRatio} label={side === 'player' ? '勇者血量' : '怪物血量'} />
      {charge && (
        <>
          <ProgressBar tone="charge" value={charge.ratio} danger={charge.danger} label="怪物蓄力" />
          <div className={styles.chargeLabel}>
            <span>
              <Icon name="lightning" tone="yellow" /> 攻擊蓄力
            </span>
            <span>{charge.text}</span>
          </div>
        </>
      )}
    </div>
  )
}
