export type HeroId = 'cat' | 'shiba' | 'bunny' | 'panda'

/** 外框與五官用的深紫色 */
export const INK = '#4a3550'

export interface Hero {
  name: string
  /** 選單上的副標 */
  sub: string
  /** 身體主色 */
  main: string
  /** 圍巾顏色 */
  scarf: string
  /** 深色花紋（貓的條紋、熊貓的耳朵與四肢） */
  dark?: string
  /** 淺色花紋（柴犬的臉與肚子） */
  light?: string
  /** 耳朵內側顏色 */
  inner?: string
}

export const HERO_ORDER: readonly HeroId[] = ['cat', 'shiba', 'bunny', 'panda']

/** 勇者表情。normal：一般；happy：開心（攻擊、勝利）；hurt：受傷（被打、失敗）；ko：倒地 */
export type HeroExpression = 'normal' | 'happy' | 'hurt' | 'ko'

export const HERO_EXPRESSIONS: readonly HeroExpression[] = ['normal', 'happy', 'hurt', 'ko']

export const DEFAULT_HERO: HeroId = 'cat'

export const HEROES: Readonly<Record<HeroId, Hero>> = {
  cat: { name: '喵喵', sub: '橘貓・愛睡覺', main: '#ffb86b', dark: '#e8893a', inner: '#ffc9d6', scarf: '#ff8fab' },
  shiba: { name: '柴柴', sub: '柴犬・很會笑', main: '#f6a55b', light: '#fff4e6', inner: '#fff4e6', scarf: '#6fd6b0' },
  bunny: { name: '兔兔', sub: '白兔・跳很快', main: '#ffffff', inner: '#ffc9d6', scarf: '#b79ced' },
  panda: { name: '熊熊', sub: '熊貓・吃竹子', main: '#ffffff', dark: INK, scarf: '#ffd166' },
}

/** 把任意值（例如 localStorage 讀出來的字串）轉成合法的勇者代號，不合法就用預設 */
export function toHeroId(value: unknown): HeroId {
  return HERO_ORDER.includes(value as HeroId) ? (value as HeroId) : DEFAULT_HERO
}
