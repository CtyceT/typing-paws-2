# 喵喵打字大冒險 2.0（Typing Paws 2.0）

AI 個人化英文打字冒險遊戲。TAICA「生成式AI：文字與圖像生成的原理與實務」課程的期末專案，
由作業五的單檔版《喵喵打字大冒險》擴充而來。

- **2.0 線上版（已上線）**：https://ctycet.github.io/typing-paws-2/
- 1.0 線上版（作業五）：https://ctycet.github.io/typing-paws/

目前是 `v2.0-alpha`：已經把 1.0 的經典闖關完整搬到 React，並通過與 1.0 的對照驗收。
故事模式、弱點特訓、每日挑戰等 AI 功能還在開發中，選單上會標示「即將推出」。

## 怎麼玩

1. 打開線上版，選一隻勇者（喵喵、柴柴、兔兔、熊熊）。
2. 點一個難度（簡單／普通／困難）開始戰鬥，按 Enter 開打。
3. 照著畫面上的英文打字：
   - **打字＝攻擊**：打完一個單字就會對怪物造成傷害，字越長越痛。
   - **連擊加成**：連續打對累積 Combo，每 10 下傷害倍率 +0.5（最高 ×3）。
   - **小心反擊**：怪物的黃色蓄力條滿了就會攻擊你；打錯字會讓它蓄力更快。
   - **三關闖關**：打倒 3 隻怪物就通關。
4. 打完會看到結算畫面（星等、WPM、準確率、評語），成績會自動存在你自己的瀏覽器，
   回主選單可以看到最佳紀錄、最近 6 場戰績和 WPM 走勢圖。

小提示：
- 請用**英文輸入法**。切到注音等輸入法時遊戲會自動暫停並提醒你；開著 Caps Lock 也會提醒。
- 戰鬥中按 **Esc** 可以暫停；切換到別的分頁也會自動暫停，暫停時不計時。
- 玩過 1.0 的話，第一次開啟 2.0 會問你要不要匯入舊的勇者和戰績（1.0 的紀錄不會被更動）。
- 紀錄只存在瀏覽器的 localStorage，換瀏覽器或清除網站資料就會不見。

## 本機開發

需要 Node.js（版本見 `.nvmrc`）。

```bash
npm install
npm run dev     # 本機開發，開 http://localhost:5173/typing-paws-2/
npm run test    # Vitest 單元測試
npm run lint    # ESLint
npm run build   # 建置到 dist/
```

push 到 `main` 後，GitHub Actions 會跑 lint、test、build 並自動部署到 GitHub Pages。

## 技術

- 前端：React + TypeScript + Vite，純 CSS／CSS Modules
- 圖表：Chart.js（react-chartjs-2）
- 遊戲核心邏輯是 `src/game/` 裡的純函式，都有單元測試；React 元件只負責畫面
- 規劃中：Supabase（帳號、雲端紀錄、Edge Functions）與生成式 AI 出題、AI 生成怪物

## 文件

- `docs/proposal.md`：完整企劃書
- `docs/ROADMAP.md`：功能進度與每項的完成條件
- `docs/DEVLOG.md`：開發紀錄（做了什麼、遇到的問題和解法）
- `legacy/index.html`：作業五的 1.0 單檔版
