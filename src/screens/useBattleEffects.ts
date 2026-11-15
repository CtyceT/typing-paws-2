import { useCallback, useEffect, useRef, useState } from 'react'
import {
  effectsForEvents,
  FLOAT_MS,
  PARTICLE_MS,
  type BattleEvent,
  type EffectCommand,
  type EffectTarget,
  type FloatTone,
  type ShakeTarget,
  type SpriteAnim,
} from '../game/index.ts'

export interface ActiveAnim {
  anim: SpriteAnim
  /** 每播一次就換一個 id，用來讓同一個動畫可以重播 */
  id: number
}

export interface FloatText {
  id: number
  target: EffectTarget
  text: string
  tone: FloatTone
  /** 水平方向的隨機偏移（px），避免數字疊在一起 */
  offsetX: number
}

export interface Particle {
  id: number
  target: 'hero' | 'monster'
  emoji: string
  /** 飛出去的位移（px） */
  dx: number
  dy: number
}

/** 戰鬥畫面目前正在播的特效 */
export interface BattleEffects {
  heroAnim: ActiveAnim | null
  monsterAnim: ActiveAnim | null
  floats: readonly FloatText[]
  particles: readonly Particle[]
  /** 每震動（或彈、晃）一次就加一 */
  shakes: Readonly<Record<ShakeTarget, number>>
}

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]

/**
 * 把戰鬥事件變成畫面上的特效。eventLog 是整場累積的事件，只會越來越長；
 * stage 換關時會把怪物的倒地狀態清掉。播什麼、隔多久播由 effectsForEvents（純函式）決定。
 */
export function useBattleEffects(eventLog: readonly BattleEvent[], stage: number): BattleEffects {
  const [heroAnim, setHeroAnim] = useState<ActiveAnim | null>(null)
  const [monsterAnim, setMonsterAnim] = useState<(ActiveAnim & { stage: number }) | null>(null)
  const [floats, setFloats] = useState<FloatText[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [shakes, setShakes] = useState<Record<ShakeTarget, number>>({ arena: 0, word: 0, combo: 0 })
  const processed = useRef(0)
  const nextId = useRef(1)
  const timers = useRef(new Set<number>())
  const stageRef = useRef(stage)
  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }, [])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])

  const play = useCallback(
    (cmd: EffectCommand) => {
      const id = nextId.current++
      switch (cmd.type) {
        case 'sprite': {
          // 已經倒地的角色不會再被別的動畫蓋掉（例如倒地前一刻排好的「被打到」）
          if (cmd.target === 'hero') {
            setHeroAnim((cur) => (cur?.anim === 'ko' ? cur : { anim: cmd.anim, id }))
            // 倒地不會自己恢復；其他動畫播完回到待機（除非中途已經換成別的動畫）
            if (cmd.anim !== 'ko') later(cmd.durationMs, () => setHeroAnim((cur) => (cur?.id === id ? null : cur)))
          } else {
            const stage = stageRef.current
            setMonsterAnim((cur) => (cur?.anim === 'ko' && cur.stage === stage ? cur : { anim: cmd.anim, id, stage }))
            if (cmd.anim !== 'ko') later(cmd.durationMs, () => setMonsterAnim((cur) => (cur?.id === id ? null : cur)))
          }
          break
        }
        case 'float':
          setFloats((list) => [...list, { id, target: cmd.target, text: cmd.text, tone: cmd.tone, offsetX: Math.random() * 30 - 15 }])
          later(FLOAT_MS, () => setFloats((list) => list.filter((f) => f.id !== id)))
          break
        case 'burst': {
          const added: Particle[] = Array.from({ length: cmd.count }, (_, i) => {
            const angle = Math.random() * Math.PI * 2
            const dist = 50 + Math.random() * 70
            return { id: id * 100 + i, target: cmd.target, emoji: pick(cmd.emojis), dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist - 20 }
          })
          const ids = new Set(added.map((p) => p.id))
          setParticles((list) => [...list, ...added])
          later(PARTICLE_MS, () => setParticles((list) => list.filter((p) => !ids.has(p.id))))
          break
        }
        case 'shake':
          setShakes((s) => ({ ...s, [cmd.target]: s[cmd.target] + 1 }))
          break
      }
    },
    [later],
  )

  // 有新事件就排程對應的特效
  useEffect(() => {
    const fresh = eventLog.slice(processed.current)
    processed.current = eventLog.length
    for (const cmd of effectsForEvents(fresh)) later(cmd.delayMs, () => play(cmd))
  }, [eventLog, later, play])

  return {
    heroAnim,
    // 換關之後，上一隻怪物的動畫（包含倒地）就不算數了
    monsterAnim: monsterAnim && monsterAnim.stage === stage ? monsterAnim : null,
    floats,
    particles,
    shakes,
  }
}
