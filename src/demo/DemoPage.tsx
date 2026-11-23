import { useState } from 'react'
import {
  Button,
  Card,
  HeroAvatar,
  HeroCard,
  Icon,
  MessageDialog,
  MonsterSprite,
  ProgressBar,
  StickerIcon,
  Tag,
  type MessageDialogProps,
} from '../components/index.ts'
import {
  DEFAULT_HERO,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  HERO_EXPRESSIONS,
  HERO_ORDER,
  MONSTERS,
  createBattle,
  createSeededRng,
  type BattleState,
  type HeroExpression,
  type HeroId,
  type IconName,
  type IconTone,
} from '../game/index.ts'
import { BattleView } from '../screens/BattleView.tsx'
import styles from './DemoPage.module.css'

/** 文字內容刻意和 1.0 版相同，方便截圖並排比對 */
const HOW: readonly { icon: IconName; tone: IconTone; title: string; text: string }[] = [
  { icon: 'keyboard', tone: 'yellow', title: '打字＝攻擊', text: '打完一個單字就會對怪物造成傷害，字越長越痛' },
  { icon: 'fire', tone: 'pink', title: '連擊加成', text: '連續打對累積 Combo，每 10 下傷害倍率 +0.5（最高 ×3）' },
  { icon: 'hourglass', tone: 'mint', title: '小心反擊', text: '怪物的黃色蓄力條滿了就會攻擊你；打錯字會讓它蓄力更快' },
  { icon: 'trophy', tone: 'lilac', title: '三關闖關', text: '打倒 3 隻怪物就通關，成績與最佳紀錄會自動保存' },
]

const EXPRESSION_LABELS: Record<HeroExpression, string> = {
  normal: '一般',
  happy: '開心',
  hurt: '受傷',
  ko: '倒地',
}

/** 戰鬥畫面的幾種假狀態 */
const BATTLE_BASE = createBattle('normal', { words: ['pineapple', 'commit & push', 'keyboard', 'rainbow'], rng: createSeededRng(7) })
const BATTLE_SAMPLES: Record<string, { label: string; state: BattleState }> = {
  opening: { label: '開場', state: createBattle('easy', { rng: createSeededRng(3) }) },
  mid: {
    label: '打到一半',
    state: { ...BATTLE_BASE, phase: 'running', index: 4, combo: 12, maxCombo: 12, correct: 86, typed: 90, score: 540, monsterHp: 71, playerHp: 76, charge: 0.4, activeMs: 31400 },
  },
  error: {
    label: '打錯',
    state: { ...BATTLE_BASE, phase: 'running', index: 2, errorFlash: true, correct: 40, typed: 46, wrong: 6, score: 210, monsterHp: 110, charge: 0.62, activeMs: 18200 },
  },
  danger: {
    label: '蓄力快滿＋爆擊倍率',
    state: { ...BATTLE_BASE, phase: 'running', index: 6, combo: 24, maxCombo: 24, correct: 150, typed: 152, score: 1480, monsterHp: 20, playerHp: 34, charge: 0.9, activeMs: 52000 },
  },
  boss: {
    label: '魔王關',
    state: { ...BATTLE_BASE, stage: 2, monsterHp: 224, monsterMaxHp: 224, playerHp: 88, score: 2600, activeMs: 70000, correct: 210, typed: 220 },
  },
  lost: { label: '被打倒', state: { ...BATTLE_BASE, phase: 'lost', playerHp: 0, charge: 0, activeMs: 44000, correct: 90, typed: 120 } },
}

type DialogContent = Omit<MessageDialogProps, 'open'>

/** 共用元件展示頁，只在開發模式用 ?demo 開啟 */
export default function DemoPage() {
  const [dialog, setDialog] = useState<DialogContent | null>(null)
  const [value, setValue] = useState(0.64)
  const [hero, setHero] = useState<HeroId>(DEFAULT_HERO)
  const [expression, setExpression] = useState<HeroExpression>('normal')
  const [sample, setSample] = useState('opening')
  const close = () => setDialog(null)
  const first = MONSTERS[0]

  const openIntro = () =>
    setDialog({
      icon: <MonsterSprite monster={first} />,
      title: `${first.name} 出現了！`,
      text: `「${first.line}」\n把字打完就能攻擊，小心黃色蓄力條！\n記得先切換成「英文」輸入法喔`,
      buttons: [{ label: '開打！（Enter）', icon: 'sword', primary: true, onClick: close }],
    })
  const openPause = () =>
    setDialog({
      icon: <StickerIcon name="pause" tone="mint" />,
      title: '暫停中',
      text: '喘口氣，準備好再繼續！',
      buttons: [
        { label: '繼續（Esc）', icon: 'play', primary: true, onClick: close },
        { label: '放棄回選單', icon: 'flag', onClick: close },
      ],
    })

  return (
    <main>
      <h1>共用元件展示</h1>

      <div className={styles.title}>卡片 Card</div>
      <div className={styles.howGrid} data-demo="cards">
        {HOW.map((h) => (
          <Card key={h.title} className={styles.how}>
            <StickerIcon name={h.icon} tone={h.tone} size={50} className={styles.e} />
            <b>{h.title}</b>
            <small>{h.text}</small>
          </Card>
        ))}
      </div>

      <div className={styles.title}>按鈕 Button</div>
      <div className={styles.row} data-demo="buttons">
        <Button data-demo="btn-primary">
          <Icon name="sword" /> 開打！（Enter）
        </Button>
        <Button variant="ghost" data-demo="btn-ghost">
          <Icon name="flag" /> 放棄回選單
        </Button>
        <Button size="small">小的主要按鈕</Button>
      </div>

      <div className={styles.title}>卡片裡的小按鈕與標籤 Tag</div>
      <Card>
        <div className={styles.row} data-demo="tags">
          {DIFFICULTY_ORDER.map((d) => (
            <Tag key={d} tone={d}>
              {DIFFICULTIES[d].label}
            </Tag>
          ))}
          <Button variant="ghost" size="small" data-demo="btn-small-ghost">
            <Icon name="broom" /> 清除紀錄
          </Button>
        </div>
      </Card>

      <div className={styles.title}>進度條 ProgressBar</div>
      <div className={styles.bars} data-demo="bars">
        <ProgressBar tone="player" value={value} label="勇者血量" />
        <ProgressBar tone="monster" value={value} label="怪物血量" />
        <ProgressBar tone="charge" value={value} danger={value > 0.75} label="怪物蓄力" />
      </div>
      <label className={styles.slider}>
        進度
        <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => setValue(Number(e.target.value))} />
        {Math.round(value * 100)}%（蓄力條超過 75% 變紅）
      </label>

      <div className={styles.title}>勇者 HeroAvatar</div>
      {/* 勇者選擇卡片 HeroCard：滑過會浮起並變成開心表情 */}
      <div className={styles.avatarGrid} data-demo="heroes">
        {HERO_ORDER.map((id) => (
          <HeroCard key={id} hero={id} selected={id === hero} data-demo={`hero-${id}`} onClick={() => setHero(id)} />
        ))}
      </div>
      <div className={styles.row} style={{ marginTop: 18 }}>
        <div className={styles.preview} data-demo="hero-preview">
          <HeroAvatar hero={hero} expression={expression} className={styles.previewSvg} />
        </div>
        <div className={styles.row} role="group" aria-label="表情">
          {HERO_EXPRESSIONS.map((e) => (
            <Button
              key={e}
              size="small"
              variant={e === expression ? 'primary' : 'ghost'}
              aria-pressed={e === expression}
              data-demo={`expression-${e}`}
              onClick={() => setExpression(e)}
            >
              {EXPRESSION_LABELS[e]}
            </Button>
          ))}
        </div>
      </div>

      <div className={styles.title}>訊息視窗 MessageDialog</div>
      <div className={styles.row}>
        <Button variant="ghost" data-demo="open-intro" onClick={openIntro}>
          開場訊息
        </Button>
        <Button variant="ghost" data-demo="open-pause" onClick={openPause}>
          暫停訊息
        </Button>
      </div>

      <div className={styles.title}>戰鬥畫面 BattleView（假資料）</div>
      <div className={styles.row} style={{ marginBottom: 16 }}>
        {Object.entries(BATTLE_SAMPLES).map(([id, s]) => (
          <Button key={id} size="small" variant={id === sample ? 'primary' : 'ghost'} onClick={() => setSample(id)}>
            {s.label}
          </Button>
        ))}
      </div>
      <div data-demo="battle">
        <BattleView state={BATTLE_SAMPLES[sample].state} hero={hero} />
      </div>

      {dialog && <MessageDialog open {...dialog} />}
    </main>
  )
}
