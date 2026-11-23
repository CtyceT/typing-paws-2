import type { ParticleShape as Shape } from '../game/index.ts'

const INK = '#4a3550'

const PATHS: Record<Exclude<Shape, 'dot'>, string> = {
  // 五角星（圓角）
  star: 'M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8z',
  // 四角閃光
  sparkle: 'M12 1.5c.9 5.2 2.3 6.7 9.5 10.5-7.2 3.8-8.6 5.3-9.5 10.5-.9-5.2-2.3-6.7-9.5-10.5 7.2-3.8 8.6-5.3 9.5-10.5z',
  heart: 'M12 21s-8.5-5.2-8.5-11.2A4.8 4.8 0 0 1 12 6.9a4.8 4.8 0 0 1 8.5 2.9C20.5 15.8 12 21 12 21z',
}

/** 戰鬥特效的一顆粒子：貼紙風的小星星、閃光、愛心、圓點（取代 1.0 版的 emoji 粒子，D90） */
export function ParticleShape({ shape, color }: { shape: Shape; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" data-shape={shape}>
      {shape === 'dot' ? (
        <circle cx="12" cy="12" r="6.5" fill={color} stroke={INK} strokeWidth="2" />
      ) : (
        <path d={PATHS[shape]} fill={color} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      )}
    </svg>
  )
}
