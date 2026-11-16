# Typing Paws 2.0 — 開發紀錄（DEVLOG）

記錄每個階段做了什麼、遇到什麼問題、怎麼解決。功能清單與完成條件看 `docs/ROADMAP.md`。

## 階段 0：專案骨架（2026-11-14 ～ 11-15）

**做了什麼**
- 0.1 用 Vite + React + TypeScript 建立專案，加上 ESLint 與 Vitest（jsdom + Testing Library）。
- 0.2 設定 `base: /typing-paws-2/`，新增 GitHub Actions workflow：lint → test → build → 部署到 GitHub Pages。
- 0.3 第一次線上部署成功：https://ctycet.github.io/typing-paws-2/
- 舊版單檔遊戲保留在 `legacy/index.html` 當對照。

**遇到的問題與解法**
- **github-pages 環境擋住 main 分支**：workflow 的 build 過了，但 deploy 這一步被 `github-pages` 環境的部署分支限制拒絕。
  原因是這個環境的允許部署分支裡只有 `master`，沒有 `main`。
  解法：用 `gh` 把 `main` 加進 `github-pages` 環境的允許部署分支，重跑 workflow 後部署成功，之後再把用不到的 `master` 移除。
- **Actions 的 Node 版本警告**：把 workflow 用到的官方 action 升到跑在 Node 24 的版本。

## 階段 1：把作業五搬進 React（2026-11-15 ～ 11-16）

**做了什麼**
- 1.1～1.6 純函式（`src/game/`，全部有單元測試）：遊戲資料與型別、輸入正規化（全形轉半形）、Combo 與傷害、
  WPM／準確率／星等、出題佇列（可注入亂數）、戰鬥狀態 reducer（不靠畫面就能跑完一場三關戰鬥）。
- 1.7～1.8 貼紙風共用元件（卡片、按鈕、標籤、進度條、訊息視窗）與四種 SVG 勇者、四種表情；
  加了只在開發時看得到的展示頁（`?demo`）。
- 1.9～1.12 主選單、戰鬥畫面、鍵盤輸入串接、遊戲迴圈（倒數、蓄力與反擊、三關流程）。
- 1.13～1.14 暫停（Esc、按鈕、切換分頁）、輸入法防呆、Caps Lock 提醒。
- 1.15 戰鬥動畫與特效：由 reducer 產生的事件驅動，支援「減少動態效果」。
- 1.16 結算畫面：星等、六項數據、評語、新紀錄標示。
- 1.17 本機紀錄：各難度最佳紀錄、最近 30 場歷史、清除紀錄（先確認）。
- 1.17a 第一次開啟時詢問要不要匯入 1.0 的舊紀錄。
- 1.18 主選單戰績區：最近 6 場表格與最近 10 場 WPM 走勢圖（Chart.js）。

**遇到的問題與解法**
- **Ubuntu 20.04 裝不了 Playwright**：Playwright 沒有提供 Ubuntu 20.04 的瀏覽器，安裝會失敗。
  解法：安裝與執行時都加環境變數 `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu22.04-x64`，改用 22.04 的瀏覽器
  （已寫在 `scripts/compare-legacy.mjs` 與 `scripts/screenshot.mjs` 開頭的註解）。
- **怎麼確認外觀和 1.0 一樣**：寫了 `scripts/compare-legacy.mjs`，把線上 1.0 版和本機展示頁的同一批元件截圖並排、
  算像素差異。兩個頁面的版面位置不同，外框邊緣一定會有反鋸齒雜訊，所以訂了通過標準：
  差異小於 1% 而且只出現在邊緣就直接通過；勇者 SVG 另外做「同位置比對」，必須完全相同。
- **localStorage 跟 1.0 共用網域**：1.0 和 2.0 都在 `ctycet.github.io`，localStorage 是同一份，2.0 寫錯鍵就會弄壞 1.0 的紀錄。
  解法：2.0 的鍵一律用 `typingPaws2.` 開頭並集中在 `src/storage/keys.ts`，有測試檢查每個鍵的開頭；
  1.0 的 `typingPaws.v1` 只有 `src/storage/legacy.ts` 會讀，測試確認不會對它寫入或刪除。
  也因為共用，才能做 1.17a 的「匯入舊紀錄」。
- **localStorage 的資料不可信**：可能是壞掉的 JSON、被手動改過，或無痕模式下根本不能用。
  解法：讀取一律經過驗證函式（`parseRecords`、`parseLegacyStore`），不合格的部分直接略過；
  讀寫都包在 try/catch 裡，存不進去就只在這次瀏覽有效，遊戲不會卡住。
- **戰績的資料結構要能搬進 Supabase**：`GameRecord` 設計成扁平的一列，有 `id` 與時間戳、沒有巢狀；
  從 1.0 匯入的舊紀錄沒有總傷害和用時，這兩欄允許 `null`。
- **小按鈕的陰影**：1.0 的小按鈕滑過、按下時陰影不會變，和大按鈕不一致。2.0 刻意改成一致，並記在 ROADMAP 的「刻意與 1.0 版不同的地方」。
- **CSS Modules 不保證載入順序**：元件自己的樣式有時會蓋過畫面想覆寫的樣式（例如玩法說明卡片的 padding）。
  解法：覆寫時多加一層選擇器提高優先度。
- **動畫和畫面邏輯綁在一起不好測**：改成 reducer 在狀態裡產生事件（命中、受擊、倒地…），畫面只負責把事件播成動畫，
  規則本身用單元測試驗證。
- **jsdom 沒有 canvas**：Chart.js 在測試環境畫不出來。解法：測試裡把 `react-chartjs-2` 的 `Line` 換成假元件，
  只檢查交給圖表的資料；實際外觀用 Playwright 截圖確認。走勢圖的資料整理（`wpmTrend`）是純函式，另外有單元測試。
- **對話因為用量上限中斷**：1.16 做到一半時中斷。因為每個項目各自 commit、純函式先寫好並有測試，
  接手時用 `git status`、`git log` 和跑測試就能確認進度，不用重做。

## 版本
- `v2.0-alpha`（2026-11-16）：階段 0 與階段 1 的 1.1～1.18 完成，剩 1.19 與線上 1.0 版對照驗收。
