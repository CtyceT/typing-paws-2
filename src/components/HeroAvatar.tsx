import type { SVGAttributes } from 'react'
import { HEROES, INK, type HeroExpression, type HeroId } from '../game/index.ts'
import styles from './HeroAvatar.module.css'

export interface HeroAvatarProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
  /** 勇者代號 */
  hero: HeroId
  /** 表情，預設 normal */
  expression?: HeroExpression
}

const WHITE = '#ffffff'
const CREAM = '#fff4e6'
const EAR_PINK = '#ffc9d6'

/** 所有外框共用的描邊 */
const OUTLINE = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' } as const

/**
 * 手繪 SVG 勇者，座標與顏色照搬 1.0 版的 avatarSVG()。
 * 元件本身不設寬度（高度自動），由使用的地方用 className 或 style 決定大小。
 */
export function HeroAvatar({ hero, expression = 'normal', className, ...rest }: HeroAvatarProps) {
  const a = HEROES[hero]
  const isPanda = hero === 'panda'
  const limb = isPanda ? INK : a.main
  const eye = isPanda ? WHITE : INK
  const glint = isPanda ? INK : WHITE
  const inner = a.inner ?? EAR_PINK
  const light = a.light ?? CREAM
  const dark = a.dark ?? INK

  return (
    <svg
      viewBox="0 0 120 124"
      aria-hidden="true"
      data-hero={hero}
      data-expression={expression}
      className={[styles.avatar, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {/* 地上的影子、腳、身體 */}
      <ellipse cx="60" cy="119" rx="30" ry="4.5" fill={INK} opacity=".15" />
      <ellipse cx="47" cy="112" rx="9.5" ry="6" fill={limb} {...OUTLINE} />
      <ellipse cx="73" cy="112" rx="9.5" ry="6" fill={limb} {...OUTLINE} />
      <ellipse cx="60" cy="97" rx="25" ry="17" fill={a.main} {...OUTLINE} />

      {/* 肚子 */}
      {hero === 'cat' && <ellipse cx="60" cy="101" rx="13" ry="9" fill={CREAM} />}
      {hero === 'shiba' && <ellipse cx="60" cy="101" rx="14" ry="10" fill={light} />}
      {hero === 'bunny' && <ellipse cx="60" cy="101" rx="13" ry="9" fill="#fdf0f6" />}

      {/* 手 */}
      <ellipse cx="36" cy="97" rx="7.5" ry="9.5" transform="rotate(20 36 97)" fill={limb} {...OUTLINE} />
      <ellipse cx="84" cy="97" rx="7.5" ry="9.5" transform="rotate(-20 84 97)" fill={limb} {...OUTLINE} />

      {/* 耳朵（畫在頭後面） */}
      {hero === 'cat' && (
        <>
          <path d="M28 44 L31 9 L57 27 Z" fill={a.main} {...OUTLINE} />
          <path d="M92 44 L89 9 L63 27 Z" fill={a.main} {...OUTLINE} />
          <path d="M35 33 L36 19 L47 27 Z" fill={inner} />
          <path d="M85 33 L84 19 L73 27 Z" fill={inner} />
        </>
      )}
      {hero === 'shiba' && (
        <>
          <path d="M27 46 Q25 12 36 10 Q50 16 58 28 Z" fill={a.main} {...OUTLINE} />
          <path d="M93 46 Q95 12 84 10 Q70 16 62 28 Z" fill={a.main} {...OUTLINE} />
          <path d="M35 34 Q34 21 39 19 Q46 23 49 28 Z" fill={inner} />
          <path d="M85 34 Q86 21 81 19 Q74 23 71 28 Z" fill={inner} />
        </>
      )}
      {hero === 'bunny' && (
        <>
          <g transform="rotate(-12 45 24)">
            <ellipse cx="45" cy="18" rx="10.5" ry="25" fill={a.main} {...OUTLINE} />
            <ellipse cx="45" cy="20" rx="4.5" ry="16" fill={inner} />
          </g>
          <g transform="rotate(14 75 24)">
            <ellipse cx="75" cy="18" rx="10.5" ry="25" fill={a.main} {...OUTLINE} />
            <ellipse cx="75" cy="20" rx="4.5" ry="16" fill={inner} />
          </g>
        </>
      )}
      {isPanda && (
        <>
          <circle cx="30" cy="32" r="12" fill={INK} />
          <circle cx="90" cy="32" r="12" fill={INK} />
        </>
      )}

      {/* 頭 */}
      <ellipse cx="60" cy="56" rx="38" ry="30" fill={a.main} {...OUTLINE} />

      {/* 臉上的花紋 */}
      {hero === 'cat' && (
        <>
          <path d="M60 27 v9 M50 29 l2.5 7 M70 29 l-2.5 7" stroke={dark} strokeWidth="4.5" strokeLinecap="round" />
          <path
            d="M29 63 L14 60 M29 69 L14 71 M91 63 L106 60 M91 69 L106 71"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}
      {hero === 'shiba' && (
        <>
          <ellipse cx="60" cy="72" rx="25" ry="14" fill={light} />
          <circle cx="46" cy="44" r="3.5" fill={light} />
          <circle cx="74" cy="44" r="3.5" fill={light} />
        </>
      )}
      {hero === 'bunny' && (
        <path d="M54 40 q6 -5 12 0" stroke={inner} strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      {isPanda && (
        <>
          <ellipse cx="45" cy="57" rx="9.5" ry="11.5" transform="rotate(22 45 57)" fill={INK} />
          <ellipse cx="75" cy="57" rx="9.5" ry="11.5" transform="rotate(-22 75 57)" fill={INK} />
        </>
      )}

      {/* 圍巾。1.0 版在這裡重複寫了 stroke-width（4 和 3），瀏覽器只採用第一個，所以實際是 4 */}
      <path d="M38 83 Q60 93 82 83 L83 89 Q60 99 37 89 Z" fill={a.scarf} {...OUTLINE} />
      <path d="M72 91 L80 105 L69 102 Z" fill={a.scarf} {...OUTLINE} />

      {/* 腮紅與鼻子 */}
      <ellipse cx="33" cy="70" rx="6.5" ry="4" fill="#ff9fb5" opacity=".8" />
      <ellipse cx="87" cy="70" rx="6.5" ry="4" fill="#ff9fb5" opacity=".8" />
      <ellipse cx="60" cy="64" rx="3.6" ry="2.6" fill={INK} />

      {/* 眼睛與嘴巴：只畫目前的表情 */}
      {expression === 'normal' && (
        <g>
          <ellipse cx="45" cy="57" rx="4.6" ry="5.8" fill={eye} />
          <ellipse cx="75" cy="57" rx="4.6" ry="5.8" fill={eye} />
          <circle cx="46.6" cy="54.6" r="1.8" fill={glint} />
          <circle cx="76.6" cy="54.6" r="1.8" fill={glint} />
          <path
            d="M53 68 Q56.5 73 60 68 Q63.5 73 67 68"
            stroke={INK}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      {expression === 'happy' && (
        <g>
          <path
            d="M39.5 59 Q45 51 50.5 59 M69.5 59 Q75 51 80.5 59"
            stroke={eye}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M53 68 Q60 79 67 68 Z" fill="#ff7a93" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        </g>
      )}
      {expression === 'hurt' && (
        <g>
          <path
            d="M40 52 L49.5 57 L40 62 M80 52 L70.5 57 L80 62"
            stroke={eye}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="60" cy="72" rx="4" ry="4.8" fill={INK} />
        </g>
      )}
      {expression === 'ko' && (
        <g>
          <path
            d="M40.5 52.5 L49.5 61.5 M49.5 52.5 L40.5 61.5 M70.5 52.5 L79.5 61.5 M79.5 52.5 L70.5 61.5"
            stroke={eye}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M53 72 Q56.5 68 60 72 Q63.5 76 67 72" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}
