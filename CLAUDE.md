# Typing Paws 2.0 — 專案說明（給 Claude Code）

## 這是什麼
AI 個人化英文打字冒險遊戲。是 TAICA「生成式AI：文字與圖像生成的原理與實務」課程的期末專案，
由作業五的單檔版《喵喵打字大冒險》擴充而來（舊版在 `legacy/index.html`，線上版 https://ctycet.github.io/typing-paws/）。
完整企劃書在 `docs/proposal.md`，功能進度在 `docs/ROADMAP.md`。

## 技術棧
- 前端：React + TypeScript + Vite，樣式用 CSS Modules 或純 CSS（不要引入大型 UI 套件）
- 圖表：Chart.js（react-chartjs-2）
- 後端：Supabase（Auth、PostgreSQL、Realtime、Storage、Edge Functions）
- 生成式 AI：LLM API 只能從 Supabase Edge Function 呼叫；前端永遠不碰 API 金鑰
- 部署：前端 GitHub Pages（GitHub Actions），後端 Supabase

## 常用指令
- `npm run dev`：本機開發
- `npm run build`：建置（commit 前必須能成功）
- `npm run test`：Vitest 單元測試
- `npm run lint`：ESLint

## 程式規範
- 介面文字一律繁體中文；遊戲題目是英文
- 遊戲核心邏輯（打字判定、Combo、傷害、WPM 計算、弱點分析）寫成純函式放在 `src/game/`，並且要有單元測試；React 元件只負責畫面
- 保留作業五的視覺風格：奶油色點點背景、粗深紫外框＋偏移陰影的貼紙風、Fredoka 字體、色票 #ff8fab / #6fd6b0 / #ffd166 / #b79ced / #4a3550
- 保留作業五已解決的細節：輸入法（IME）防呆、全形轉半形、Caps Lock 提醒、暫停時不計時、切換分頁自動暫停
- 所有 LLM 輸出都要驗證（只允許可列印 ASCII、長度限制、JSON schema），失敗時退回內建字庫，遊戲不能因為 AI 失敗而卡住

## 安全
- API 金鑰、Supabase service role key 只放 `.env.local` 或 Supabase secrets，`.env*` 必須在 `.gitignore`
- 前端只能使用 Supabase anon key；資料表一律開啟 Row Level Security
- Edge Function 要限制每位使用者每日呼叫次數
- 1.0 和 2.0 都在 ctycet.github.io 同一個網域，localStorage 是共用的：2.0 的所有 localStorage 鍵一律用 `typingPaws2.` 開頭，絕對不能寫入或刪除 1.0 的 `typingPaws.v1`；唯一允許讀取它的地方是 ROADMAP 1.17 的「匯入舊紀錄」功能（只讀取）

## 工作方式
- 照 ROADMAP 的順序一個項目一個項目做，每個項目各自 commit
- 純資料、純函式、有測試涵蓋的小項目：不用等我確認計畫，直接做完，連續做到下一個需要我決定的地方再停
- 遇到以下情況要先停下來問我，列出計畫和要改的檔案：
  - 畫面的外觀或操作手感
  - 會影響後續階段的資料結構
  - 任何 GitHub／Supabase／API 金鑰等外部設定
- 需求不清楚時先問我，不要自己猜
- 每個項目完成後跑 build 和 test，告訴我怎麼手動驗證，再更新 `docs/ROADMAP.md` 的勾選狀態
- 每做完一個 ROADMAP 項目就 commit，訊息用英文、簡短描述做了什麼
- 每次對話告一段落時就 push（當作備份），不用等整個階段完成
- 截圖比對（`scripts/compare-legacy.mjs`）的通過標準：像素差異小於 1% 而且只出現在邊緣，就視為反鋸齒雜訊直接通過，不用再追查原因
