import styles from './App.module.css'

function App() {
  return (
    <main className={styles.hero}>
      <div className={styles.mascot} aria-hidden="true">
        🐾
      </div>
      <h1 className={styles.title}>
        喵喵打字<span>大冒險</span> 2.0
      </h1>
      <p className={styles.subtitle}>Typing Paws — AI 個人化英文打字冒險</p>
      <section className={styles.card}>
        <h2>施工中 🚧</h2>
        <p>專案骨架已經建立，遊戲內容正在從作業五搬過來。</p>
        <a className={styles.btn} href="https://ctycet.github.io/typing-paws/">
          先玩玩 1.0 版
        </a>
      </section>
    </main>
  )
}

export default App
