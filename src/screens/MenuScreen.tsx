import { Card, DifficultyCard, HeroAvatar, HeroCard, ModeCard } from '../components/index.ts'
import { DIFFICULTY_ORDER, HERO_ORDER, MODE_ORDER, MODES, type Difficulty, type HeroId } from '../game/index.ts'
import styles from './MenuScreen.module.css'

const HOW = [
  { e: '⌨️', title: '打字＝攻擊', text: '打完一個單字就會對怪物造成傷害，字越長越痛' },
  { e: '🔥', title: '連擊加成', text: '連續打對累積 Combo，每 10 下傷害倍率 +0.5（最高 ×3）' },
  { e: '⏳', title: '小心反擊', text: '怪物的黃色蓄力條滿了就會攻擊你；打錯字會讓它蓄力更快' },
  { e: '🏆', title: '三關闖關', text: '打倒 3 隻怪物就通關，成績與最佳紀錄會自動保存' },
]

export interface MenuScreenProps {
  hero: HeroId
  onSelectHero: (hero: HeroId) => void
  /** 點難度卡片：用經典闖關模式開始戰鬥 */
  onStart: (difficulty: Difficulty) => void
}

/** 主選單：選勇者、選模式、選難度、玩法說明、戰績 */
export function MenuScreen({ hero, onSelectHero, onStart }: MenuScreenProps) {
  return (
    <main>
      <div className={styles.topbar}>
        {/* 登入按鈕的位置；帳號功能完成前先顯示訪客 */}
        <span className={styles.guest} title="登入功能即將推出">
          👤 訪客
        </span>
      </div>

      <header className={styles.hero}>
        <div className={styles.mascot}>
          <HeroAvatar hero={hero} className={styles.mascotSvg} />
        </div>
        <h1 className={styles.title}>
          喵喵打字<span>大冒險</span> 2.0
        </h1>
        <p className={styles.subtitle}>Typing Paws — AI 個人化英文打字冒險</p>
      </header>

      <h2 className={styles.sectionTitle}>🐾 選擇你的勇者</h2>
      <div className={styles.grid4}>
        {HERO_ORDER.map((id) => (
          <HeroCard key={id} hero={id} selected={id === hero} onClick={() => onSelectHero(id)} />
        ))}
      </div>

      <h2 className={styles.sectionTitle}>🎮 選擇模式</h2>
      <div className={styles.grid4}>
        {MODE_ORDER.map((id) => (
          <ModeCard key={id} mode={id} selected={id === 'classic'} />
        ))}
      </div>

      <h2 className={styles.sectionTitle}>
        {MODES.classic.icon} {MODES.classic.label}：選擇難度開始戰鬥
      </h2>
      <div className={styles.grid3}>
        {DIFFICULTY_ORDER.map((d) => (
          <DifficultyCard key={d} difficulty={d} onClick={() => onStart(d)} />
        ))}
      </div>

      <h2 className={styles.sectionTitle}>📖 玩法說明</h2>
      <div className={styles.howGrid}>
        {HOW.map((h) => (
          <Card key={h.title} className={styles.how}>
            <div className={styles.e} aria-hidden="true">
              {h.e}
            </div>
            <b>{h.title}</b>
            <small>{h.text}</small>
          </Card>
        ))}
      </div>

      {/* 戰績的內容在 ROADMAP 1.17、1.18 才會接上，這裡先放外框和空狀態 */}
      <h2 className={styles.sectionTitle}>📈 我的戰績</h2>
      <div className={styles.historyWrap}>
        <Card>
          <div className={styles.sparkLabel}>最近 10 場 WPM 走勢</div>
          <div className={styles.empty}>玩 2 場以上就會畫出你的進步曲線 📈</div>
        </Card>
        <Card>
          <div className={styles.empty}>
            還沒有戰績 🐾
            <br />
            完成一場戰鬥後會出現在這裡
          </div>
        </Card>
      </div>

      <footer className={styles.footer}>
        小提示：戰鬥中按 <b>Esc</b> 可以暫停 ・ 紀錄只存在你自己的瀏覽器
      </footer>
    </main>
  )
}
