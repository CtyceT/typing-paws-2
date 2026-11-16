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

## 階段 2：數據儀表板（本機版）（2026-11-16）

這個階段是在「自主模式」下連續做完的：原本要先問的決定（資料結構、畫面外觀）由 Claude 依企劃書和現有風格直接決定，
每個決定和理由記在 `docs/DECISIONS.md`（D1～D30）。

**做了什麼**
- 2.1 按鍵統計的資料結構 `KeyStatRow`（每場、每個鍵一列，欄位對照日後的 `key_stats` 資料表）與儲存介面 `KeyStatsStore`（localStorage 實作）。
- 2.2 按鍵紀錄器：戰鬥 reducer 記下每次按鍵的預期字元、實際字元、對錯、間隔；一場結束時彙整存檔。
- 2.3 彙整純函式：每個字母、每個字母組合的次數、錯誤率、平均反應時間。
- 2.4 弱點分析純函式：選出最弱的字母或組合（最多 5 個），樣本太少的不列入。
- 2.5 儀表板頁面與入口（主選單戰績區的按鈕），沒有資料時顯示引導。
- 2.6 鍵盤熱力圖：QWERTY 鍵盤依錯誤率分 5 級上色，移到按鍵上看得到數字。
- 2.7 WPM／準確率趨勢圖：上下兩張折線圖，可切換最近 10 場與全部。
- 2.8 弱點排行榜。
- 2.9 結算畫面顯示「這場最常打錯的鍵」，並可連到儀表板。
- 新增 `scripts/verify-dashboard.mjs`：用 Playwright 真的打兩場再核對統計與畫面，截圖存在 `.compare/dashboard/`。

**遇到的問題與解法**
- **原始按鍵紀錄太大，不能直接存**：一場有上百到幾百次按鍵，存 30 場會吃掉 localStorage 很大一部分（而且和 1.0 共用網域）。
  解法：原始紀錄只留在記憶體，一場結束就彙整成「每個鍵一列」的統計。實測一場簡單難度大約 80 列，30 場估計 0.3～0.7 MB。
- **統計要存總和，不能存平均**：平均值沒辦法跨場次合併。改存「次數、錯誤數、計時次數、時間總和」，要用的時候再除。
- **暫停時間怎麼不算進按鍵間隔**：一開始想在 React 這邊記時間戳再扣掉暫停，很容易漏。
  後來發現 reducer 本來就有一個只在戰鬥進行中才累計的 `activeMs`，直接用它算間隔，暫停、倒數、過關訊息自然都不會算進去；
  紀錄器也因此變成純函式，可以不靠畫面測試。
- **反應時間被雜訊拉高**：改錯字的那一鍵、發呆後的第一鍵會讓平均時間失真。
  解法：只算「打對、上一鍵也打對、間隔 2 秒以內」的按鍵；每一關和暫停後的第一鍵不計時。
- **樣本太少的鍵會誤導**：只打過 2 次錯 1 次就是 50%。熱力圖對不到 5 次的鍵不上色，弱點分析也設了樣本門檻。
- **雙縱軸的圖容易誤讀**：WPM 和準確率單位不同，畫在同一張圖的左右兩個縱軸上，線的交叉沒有意義。改成上下兩張、橫軸對齊的圖。
- **粉紅線和綠線對紅綠色弱的人分不出來**：用色覺模擬的檢查工具驗了一下才發現。
  既然已經分成兩張有標題的圖，線就統一用深紫色；通關／被打倒的點除了顏色再加上形狀（圓點／三角形）。
- **手機上鍵盤塞不下**：最長的一排有 13 顆鍵。每顆鍵的寬度用「容器寬度的 1/13」來算，390px 寬也排得下；圓角要跟著縮，不然小鍵會變成圓形。
- **同一個檔案裡的兩個 ROADMAP 項目要分開 commit**：2.3 和 2.4 寫在同一個檔案，先把檔案截到 2.3 的部分 commit（確認測試、lint、build 都過），再放回完整的檔案 commit 2.4。
- **測試環境沒有 canvas**（延續階段 1）：單元測試檢查交給圖表的資料，實際有沒有畫出來由 `verify-dashboard.mjs` 讀 canvas 的像素確認。

**還沒做、留給之後的**
- 打包大小：JS 目前約 447 kB（gzip 149 kB），Chart.js 佔了大約 165 kB，ROADMAP 11.5 會改成動態載入。
- 弱點分析的門檻（錯誤率 8%、比平均慢 35%）是先訂的起始值，還沒有用真人的資料校正。

## 階段 3：帳號與雲端紀錄（2026-11-16）

和階段 2 一樣在「自主模式」下連續做完，決定記在 `docs/DECISIONS.md`（D31～D52）。

**做了什麼**
- 3.1 Supabase 連線（`src/cloud/supabase.ts`）、`.env.example`；沒設定環境變數時遊戲照常可以玩（只有訪客模式）。
- 3.2 migration：`profiles`、`game_records`、`best_records`、`key_stats` 四張表，全部開 RLS；`npm run test:db` 用內嵌的 Postgres 實測 38 項。
- 3.3 GitHub 登入與登出，主選單右上角的帳號列。
- 3.4 訪客模式：訪客和每個帳號在瀏覽器裡各有一份紀錄，畫面標示目前的身分。
- 3.5 打完一場先存本機、背景上傳；斷網不卡住，顯示尚未同步並自動補傳。
- 3.6 登入後讀取雲端紀錄併進本機（換裝置看得到同樣的戰績與儀表板）。
- 3.7 登入後詢問要不要把訪客紀錄併入帳號。
- 3.8 GitHub Actions 帶入 Supabase 公開設定，並檢查打包結果沒有秘密金鑰。

**遇到的問題與解法**
- **沒有 Docker，跑不了本機的 Supabase**：改用 PGlite（WebAssembly 版的 Postgres）在 Node 裡直接跑 migration，
  再用 `set role` 模擬兩個登入帳號和沒登入的訪客來測 RLS。Supabase 專有的 `auth.users`、`auth.uid()` 用最小的替身代替。
- **Supabase 預設的 localStorage 鍵不符合前綴規定**：登入狀態預設存在 `sb-<專案>-auth-token`，和 1.0 共用網域時不該這樣命名；
  建立連線時指定 `storageKey: 'typingPaws2.auth'`，實際在瀏覽器確認過所有鍵都是 `typingPaws2.` 開頭。
- **前端產生的場次 id 不保證唯一**：從 1.0 匯入的 id 是照時間組的，兩個人可能相同。主鍵改成 `(user_id, id)`。
- **最佳紀錄沒辦法從場次算回來**（匯入的舊紀錄、超過 30 場的舊場次）：另外一張表，並用觸發器讓它只會變好。
- **「清除紀錄」在兩台裝置之間會復活**：如果合併是「兩邊取聯集」，另一台裝置會把清掉的紀錄又傳回去。
  改成「雲端說了算，但還沒上傳的留著」，並用待上傳清單和「最佳紀錄有變動」的記號分辨哪些是還沒上傳的。
- **訪客併入帳號怎麼保證不重複、不遺失**：順序訂成「先上傳成功 → 才併進帳號的本機資料 → 才清掉訪客那一份」，
  任何一步失敗都停在安全的狀態；資料庫的主鍵再擋一次重複。
- **背景同步跑完時，畫面的資料可能已經變了**（例如同步到一半又打完一場）：同步一律排隊、一次一個，
  而且合併時用「當下最新」的本機資料，不用開始同步時的那一份。
- **一次請求最多回傳 1000 列**：30 場的按鍵統計有 2000 多列，要分頁讀。
- **測試不能連到真的專案**：`vite.config.ts` 在測試時把兩個環境變數清空；App 的雲端功能可以整個換成假的（`src/test/fakeCloud.ts`，
  一個存在記憶體裡、行為照資料表規則的假資料庫），登入、斷網、補傳、換裝置、併入都是用它測的。
- **`.env.local` 是 Windows 換行（CRLF）**：Vite 讀得懂，但在 shell 裡 `source` 會把換行符號接在網址後面。只影響手動測試，沒有改檔案。

**需要你操作的事**（帳號／後台操作）
1. 把 migration 推到 Supabase 專案（在專案資料夾執行）：
   1. `npx supabase login`（會開瀏覽器登入）
   2. `npx supabase link --project-ref <專案代號>`（代號就是 `VITE_SUPABASE_URL` 裡 `https://` 和 `.supabase.co` 中間那一段；問資料庫密碼時輸入建立專案時設的密碼）
   3. `npx supabase db push --remote --dry-run` 確認只會套用還沒推過的 migration，再執行 `npx supabase db push --remote`
      （新版 CLI 的 `db push` 預設對象是本機資料庫，要加 `--remote` 才是連結的專案；舊的 `--linked` 之後會移除，不要再用）
   - 不想用 CLI 的話：把那個 `.sql` 檔的內容整份貼到後台的 SQL Editor 執行一次也可以（但之後 CLI 不會知道它已經套用過）。
2. Supabase 後台 → Authentication → URL Configuration → Redirect URLs，確認有這兩條（網站在子路徑底下，要包含路徑）：
   `http://localhost:5173/typing-paws-2/` 和 `https://ctycet.github.io/typing-paws-2/`。
   沒對上的話，登入後會被導到 Site URL 而不是原本的網址。
3. GitHub repo → Settings → Secrets and variables → Actions → **Variables** 分頁 → New repository variable，新增兩個：
   `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`（值和 `.env.local` 相同；放 Secrets 分頁也讀得到）。
   設好後到 Actions 重新執行一次 Deploy，線上版才會出現登入按鈕。

**手動驗證**（上面三步做完之後）
- 本機 `npm run dev` → 右上角「🔑 登入」→ GitHub 登入 → 回到遊戲看到自己的名稱和「☁️ 已同步」；重新整理後還是登入狀態。
- 打完一場 → 結算畫面有「☁️ 這場已存到雲端」；後台 Table Editor 的 `game_records`、`key_stats`、`best_records` 有資料。
- 開發者工具把網路切成 Offline 再打一場 → 照常結算、顯示尚未同步；切回 Online → 自動變成已同步。
- 換一個瀏覽器（或無痕視窗）登入同一個帳號 → 戰績與儀表板相同。
- 登出，用訪客玩一場再登入 → 被問要不要併入；併入後後台多一場，再重新整理不會再問、也沒有重複的列。
- 用第二個 GitHub 帳號登入 → 看不到第一個帳號的任何資料（RLS）。
- 線上版 https://ctycet.github.io/typing-paws-2/ 重複登入與同步的檢查。

**實機驗證結果**（2026-11-16，由你回報）
- ✅ migration 已用 CLI 推到專案。
- ✅ 本機與線上版都能用 GitHub 登入，右上角顯示「已同步」和帳號。
- ✅ 打完一場後 `game_records` 新增一列，資料正確。
- ✅ 每張表都有 RLS policies。
- ⬜ 手機登入同一帳號看得到戰績：還沒有回報結果。
- ⬜ 訪客併入帳號：還沒有回報結果。
- ⬜ 用第二個帳號確認看不到別人的資料：還沒有回報結果（本機的 `npm run test:db` 有測過）。

**還沒做、留給之後的**
- Google 登入（後台設定好後，把 `'google'` 加進 `AUTH_PROVIDERS`）。
- 打包大小：加入 supabase-js 後 JS 約 674 kB（gzip 209 kB），比階段 2 多了約 60 kB（gzip）。可以和 11.5 一起改成動態載入。
- 雲端保留全部場次，但畫面仍然只用最近 30 場。

## 11.5 提前做：Chart.js 與 supabase-js 改成動態載入（2026-11-16）

**結果**（`npm run build` 的數字，未壓縮／gzip）

| | 改之前 | 改之後 |
|---|---|---|
| 首頁一定會下載的 JS | 674 kB／209 kB | 約 292 kB／96 kB（`index` 280 + `jsx-runtime` 8 + `records` 4） |
| Chart.js（`ChartLine`） | 包在首頁裡 | 161 kB／56 kB，要畫圖時才下載 |
| supabase-js（`supabase`） | 包在首頁裡 | 218 kB／56 kB，要登入或已登入時才下載 |
| 儀表板（`DashboardScreen`） | 包在首頁裡 | 11 kB／5 kB，點進去才下載 |

用正式 build 在真的瀏覽器確認過：訪客沒有戰績時只下載首頁那三個檔；有 2 場以上戰績時多下載 Chart.js；
點儀表板才下載儀表板；按「GitHub 登入」才下載 supabase-js；localStorage 有登入狀態時一開始就會下載它。

**怎麼做的**
- Chart.js 只從 `src/components/ChartLine.tsx` 載入，兩個圖表元件用 `lazy()` 動態載入它。外框本來就有固定高度，載入前後版面不會跳。
- supabase-js 只從 `src/cloud/supabase.ts` 載入，外面包一層 `lazyCloud`（`src/cloud/lazy.ts`），介面和原本的 `Cloud` 一樣，App 不用改。
- 儀表板畫面也改成動態載入（見下面第二點）。

**遇到的問題與解法**
- **要先知道有沒有登入，才知道要不要下載 supabase-js，但問這件事本來就要靠 supabase-js**：
  改成先看 localStorage 有沒有 `typingPaws2.auth`、網址有沒有導回來的 `?code=`。都沒有就一定是訪客，直接進遊戲。
- **只搬 Chart.js 和 supabase-js 還差一點（302 kB）**：把儀表板畫面也改成點進去才下載。但一開始只少了 3 kB——
  熱力圖、弱點排行等元件因為從 `components/index.ts` 統一匯出，還是被打包進首頁。把這三個只有儀表板用的元件從統一匯出拿掉、
  在儀表板直接匯入之後才真的搬走。
- **測試裡的圖表和儀表板變成非同步出現**：測試用了假計時器，`findBy…` 不好用；改成先 `await import()` 同一個模組再等一輪 React 更新。
- **動態載入失敗（下載到一半斷網）**：supabase-js 載入失敗時先當訪客，下次用到再重試；資料請求會失敗而不是卡住，走原本「尚未同步」的流程。

## 版本
- `v2.0-alpha`（2026-11-16）：階段 0 與階段 1 的 1.1～1.18 完成，剩 1.19 與線上 1.0 版對照驗收。

## 階段 4：弱點特訓（LLM）（2026-11-16）

在「自主模式」下連續做完，決定記在 `docs/DECISIONS.md`（D55～D71）。

**做了什麼**
- 4.1 LLM 決定：主力 Gemini `gemini-3.5-flash-lite`，備援 Groq `openai/gpt-oss-120b`，金鑰只在 Supabase secrets。
- 4.2～4.7 Edge Function `training-words`：驗證登入、CORS、每人每日 10 次、Gemini → Groq 備援、輸出驗證、24 小時題庫快取。
  新 migration：`ai_usage`（用量與生成品質）、`training_cache`，都只有 Edge Function 能碰。
- 4.4 prompt 有版本號（`supabase/functions/_shared/training/prompts/v1.ts`）。
- 4.8 前端出題服務：失敗或逾時退回內建字庫並顯示說明。
- 4.9 主選單的弱點特訓入口、主題選擇、出題中畫面、用 AI 題目戰鬥；訪客看到「登入後即可使用」。
- 4.10 結算畫面列出特訓的鍵、這場的錯誤率和之前平均的比較。
- `scripts/try-llm.mjs`：本機直接呼叫兩家 LLM；`--eval` 跑固定的 12 個案例並產生 `docs/llm-eval.md`。

**遇到的問題與解法**
- **沒有 Docker 和 Deno，跑不了 `supabase functions serve`**：把流程寫成不依賴 Deno 的純 TypeScript（資料庫和 LLM 都從外面傳進來），
  在 Vitest 裡用假的資料庫和假的 LLM 測完整流程；真的 API 用 `scripts/try-llm.mjs` 在 Node 裡打。
- **簡單難度配罕見字母湊不到題目**：長度放寬到 3～6、門檻降到 10 題、prompt 允許罕見字母少一點。實測 q／x／z 兩家都給了 29～30 題。
- **Gemini 偶爾回 503（high demand）**：第一次評估 12 個案例裡有 3 次。這不是題目品質的問題，流程會改用 Groq。
- **困難難度配數字、符號的弱點，Gemini 的題目常常太長**（`4 ; th` 那一組 30 題只有 7 題合格）。Groq 同一組是 27 題。
  目前靠備援接住；要改善的話是調整 prompt（做成 v2 再用 `--eval` 比較）。
- **同時送很多請求可能超過每日上限**：檢查和佔用寫在同一個資料庫函式裡，用 advisory lock 讓同一個人的請求排隊。
- **React 的 StrictMode 在開發模式會把 effect 跑兩次**：出題的請求如果寫在畫面的 effect 裡會送兩次、扣兩次額度，
  所以改成在按下難度卡片的當下送出，畫面只負責等結果。

**實機驗證（部署之後）**
1. 沒帶 JWT 呼叫：`curl -i -X POST https://<專案>.supabase.co/functions/v1/training-words -d '{}'` → 401，訊息是「登入後即可使用 AI 出題。」
2. 登入後在主選單點「弱點特訓」→ 選主題 → 點難度：幾秒內進入戰鬥，題目明顯含「要練的鍵」。
3. 同一個主題和難度再開始一次：很快就開始（快取）。在 Supabase 後台看 `ai_usage`：第二筆的 `source` 是 `cache`、`counted` 是 false。
4. 登出後點「弱點特訓」：看到「登入後即可使用」。
5. 開發者工具把網路設成離線再開始特訓：跳出「這場先用內建字庫」，按開始後可以正常打完。
6. 打完一場特訓：結算畫面有「🎯 這次特訓的弱點」，主選單戰績多一場，最佳紀錄沒有變。

**期末報告可以用的查詢（在 Supabase 後台的 SQL Editor）**
```sql
-- 各模型的案例合格率、題目合格率、平均延遲
select a ->> 'model' as model, count(*) as attempts,
       round(avg((a ->> 'ok')::boolean::int) * 100, 1) as pass_pct,
       round(sum((a ->> 'valid_count')::int)::numeric / nullif(sum((a ->> 'raw_count')::int), 0) * 100, 1) as item_pass_pct,
       round(avg((a ->> 'latency_ms')::int)) as avg_ms
from public.ai_usage, jsonb_array_elements(attempts) a
group by 1;

-- 快取命中率
select source, count(*) from public.ai_usage group by 1;
```
