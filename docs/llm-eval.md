# LLM 出題品質評估

由 `node scripts/try-llm.mjs --eval` 產生，請不要手動修改（原始數字在 `docs/llm-eval.json`）。

- 做法：固定的 12 個測試案例（3 個難度 × 常見與罕見的弱點組合），每一家各生成一次，用和線上相同的 prompt、驗證規則與逾時設定。
- **案例合格率**：合格題數達到門檻（簡單 10 題、普通與困難 15 題）的案例比例，也就是線上「這一家能不能用」的機率。
- **題目合格率**：LLM 給的題目裡通過驗證的比例。
- 每個案例只跑一次，而且 temperature 是 0.9，所以數字會有起伏；差距不大時不代表真的有差別。

## 各版本比較

| prompt | 模型 | 案例合格率 | 題目合格率 | 平均延遲 | 不合格原因分布 |
|---|---|---|---|---|---|
| v1 | gemini-3.5-flash-lite | 8/12（66.7%） | 242/270（89.6%） | 1920 ms | length ×25、http_503 ×3、duplicate ×1、missing_target ×1、banned_word ×1 |
| v1 | openai/gpt-oss-120b | 12/12（100%） | 350/356（98.3%） | 3079 ms | length ×3、duplicate ×2、missing_target ×1 |

## prompt v1

執行時間：2026-11-16T14:24:23.396Z　每次呼叫的逾時：8000 ms

### 依難度與弱點類型

| 模型 | 分組 | 案例合格率 | 題目合格率 | 平均延遲 | 不合格原因分布 |
|---|---|---|---|---|---|
| gemini-3.5-flash-lite | 簡單 | 2/4 | 98.3% | 1356 ms | http_503 ×2、duplicate ×1 |
| gemini-3.5-flash-lite | 普通 | 4/4 | 97.5% | 1872 ms | length ×2、missing_target ×1 |
| gemini-3.5-flash-lite | 困難 | 2/4 | 73.3% | 2531 ms | length ×23、banned_word ×1、http_503 ×1 |
| gemini-3.5-flash-lite | 常見弱點 | 5/6 | 97.3% | 1914 ms | http_503 ×1、duplicate ×1、length ×1、missing_target ×1、banned_word ×1 |
| gemini-3.5-flash-lite | 罕見弱點 | 3/6 | 80% | 1925 ms | length ×24、http_503 ×2 |
| openai/gpt-oss-120b | 簡單 | 4/4 | 99.2% | 3380 ms | missing_target ×1 |
| openai/gpt-oss-120b | 普通 | 4/4 | 100% | 3172 ms | — |
| openai/gpt-oss-120b | 困難 | 4/4 | 95.8% | 2685 ms | length ×3、duplicate ×2 |
| openai/gpt-oss-120b | 常見弱點 | 6/6 | 98.3% | 2947 ms | duplicate ×2、missing_target ×1 |
| openai/gpt-oss-120b | 罕見弱點 | 6/6 | 98.3% | 3211 ms | length ×3 |

### 每個案例

| 難度 | 主題 | 弱點 | 類型 | 模型 | 結果 | 合格／原始 | 延遲 | 主要原因 | 題目範例 |
|---|---|---|---|---|---|---|---|---|---|
| 簡單 | daily | `e` `r` `t` | 常見 | gemini | ✗ | 0／0 | 1589 ms | http_503 | — |
| 簡單 | daily | `e` `r` `t` | 常見 | groq | ✓ | 29／29 | 2439 ms | — | `reset` `trend` `later` `treat` `enter` `tired` |
| 簡單 | school | `in` `th` | 常見 | gemini | ✓ | 29／30 | 1809 ms | duplicate | `thin` `this` `that` `than` `them` `then` |
| 簡單 | school | `in` `th` | 常見 | groq | ✓ | 29／30 | 4216 ms | missing_target | `thing` `think` `thin` `hint` `mint` `math` |
| 簡單 | fantasy | `q` `x` `z` | 罕見 | gemini | ✓ | 30／30 | 455 ms | — | `axe` `zoo` `zest` `quiz` `zone` `zero` |
| 簡單 | fantasy | `q` `x` `z` | 罕見 | groq | ✓ | 30／30 | 3322 ms | — | `quiz` `quartz` `quark` `quack` `quilt` `quill` |
| 簡單 | space | `j` `k` `v` | 罕見 | gemini | ✗ | 0／0 | 1571 ms | http_503 | — |
| 簡單 | space | `j` `k` `v` | 罕見 | groq | ✓ | 30／30 | 3544 ms | — | `joke` `jive` `jack` `junk` `juke` `jolt` |
| 普通 | space | `e` `r` `t` | 常見 | gemini | ✓ | 28／30 | 1954 ms | length | `earth` `rocket` `orbit` `fleet` `planet` `meteor` |
| 普通 | space | `e` `r` `t` | 常見 | groq | ✓ | 30／30 | 2522 ms | — | `meteor` `rocket` `planet` `asteroid` `orbit` `comet` |
| 普通 | daily | `in` `th` | 常見 | gemini | ✓ | 30／30 | 1669 ms | — | `thing` `think` `third` `thorn` `three` `tooth` |
| 普通 | daily | `in` `th` | 常見 | groq | ✓ | 29／29 | 2436 ms | — | `nothing` `within` `thinner` `thinness` `thinning` `inside` |
| 普通 | school | `q` `x` `z` | 罕見 | gemini | ✓ | 29／30 | 2056 ms | length | `exact` `zebra` `excel` `equal` `plaza` `queue` |
| 普通 | school | `q` `x` `z` | 罕見 | groq | ✓ | 30／30 | 3217 ms | — | `exams` `matrix` `pixel` `oxford` `annex` `exotic` |
| 普通 | fantasy | `j` `k` `v` | 罕見 | gemini | ✓ | 30／30 | 1809 ms | — | `joust` `kiosk` `valor` `jumbo` `kayak` `vivid` |
| 普通 | fantasy | `j` `k` `v` | 罕見 | groq | ✓ | 28／28 | 4512 ms | — | `jacket` `joker` `jovial` `viking` `vaults` `jungle` |
| 困難 | fantasy | `e` `r` `t` | 常見 | gemini | ✓ | 29／30 | 1969 ms | banned_word | `treasures` `enter the tree` `retreive it` `relic return` `test the spell` `terrifying trap` |
| 困難 | fantasy | `e` `r` `t` | 常見 | groq | ✓ | 30／30 | 4729 ms | — | `Enter the realm` `Treasure hidden deep` `Elder tree whispers` `Raven perched atop` `Forgotten relics await` `Silent forest trail` |
| 困難 | space | `ou` `th` | 常見 | gemini | ✓ | 30／30 | 2494 ms | — | `outhere path` `thought out` `the fourth` `south route` `that mouth` `without youth` |
| 困難 | space | `ou` `th` | 常見 | groq | ✓ | 28／30 | 1339 ms | duplicate | `Southward thrust` `Galaxy southbound` `Nebula about the` `Outward thrust` `Southern horizon` `Launch through clouds` |
| 困難 | daily | `q` `x` `z` | 罕見 | gemini | ✗ | 0／0 | 3058 ms | http_503 | — |
| 困難 | daily | `q` `x` `z` | 罕見 | groq | ✓ | 30／30 | 2174 ms | — | `Quick fox jumps` `Exact quiz zone` `Lazy zebra quips` `Boxed quartz gem` `Zany text quiz` `Quick pizza box` |
| 困難 | school | `4` `;` `th` | 罕見 | gemini | ✗ | 7／30 | 2603 ms | length | — |
| 困難 | school | `4` `;` `th` | 罕見 | groq | ✓ | 27／30 | 2499 ms | length | `Math 4th period` `English; thorough notes` `History 4th chapter` `Science; theory lab` `Lunch break at 4pm` `Physics; theorems ahead` |
