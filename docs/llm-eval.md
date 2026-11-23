# LLM 出題品質評估

由 `node scripts/try-llm.mjs --eval` 產生，請不要手動修改（原始數字在 `docs/llm-eval.json`）。

- 做法：固定的 12 個測試案例（3 個難度 × 常見與罕見的弱點組合），每一家各生成一次，用和線上相同的 prompt、驗證規則與逾時設定。
- **案例合格率**：合格題數達到門檻（簡單 10 題、普通與困難 15 題）的案例比例，也就是線上「這一家能不能用」的機率。
- **題目合格率**：LLM 給的題目裡通過驗證的比例。
- **驗證規則**：「基本」是格式、長度、禁用字、要含弱點鍵；「基本＋常用字」另外要求每個字都在 2 萬字的常用字表上（不在表上記為 rare_word），這是 prompt v2 一起加的、線上使用的規則。
- 每個案例只跑一次，而且 temperature 是 0.9，所以數字會有起伏；差距不大時不代表真的有差別。

## 各版本比較

| prompt | 驗證規則 | 模型 | 案例合格率 | 題目合格率 | 平均延遲 | 呼叫失敗 | 不合格原因分布 |
|---|---|---|---|---|---|---|---|
| v1 | 基本 | gemini-3.5-flash-lite | 8/12（66.7%） | 242/270（89.6%） | 1920 ms | http_503 ×3 | length ×25、duplicate ×1、missing_target ×1、banned_word ×1 |
| v1 | 基本 | openai/gpt-oss-120b | 12/12（100%） | 350/356（98.3%） | 3079 ms | — | length ×3、duplicate ×2、missing_target ×1 |
| v1 | 基本＋常用字 | gemini-3.5-flash-lite | 6/12（50%） | 172/210（81.9%） | 2206 ms | http_503 ×5 | rare_word ×28、banned_word ×6、length ×3、missing_target ×1 |
| v1 | 基本＋常用字 | openai/gpt-oss-120b | 8/12（66.7%） | 202/267（75.7%） | 2535 ms | http_400 ×3 | rare_word ×46、length ×12、duplicate ×5、missing_target ×2 |
| v2 | 基本＋常用字 | gemini-3.5-flash-lite | 7/12（58.3%） | 193/210（91.9%） | 2056 ms | http_503 ×5 | rare_word ×11、missing_target ×4、length ×2 |
| v2 | 基本＋常用字 | openai/gpt-oss-120b | 12/12（100%） | 296/357（82.9%） | 2633 ms | — | rare_word ×55、missing_target ×3、duplicate ×1、banned_word ×1、bad_chars ×1 |

## prompt v2（驗證規則：基本＋常用字）

執行時間：2026-11-16T14:53:03.921Z　每次呼叫的逾時：8000 ms

### 依難度與弱點類型

| 模型 | 分組 | 案例合格率 | 題目合格率 | 平均延遲 | 不合格原因分布 |
|---|---|---|---|---|---|
| gemini-3.5-flash-lite | 簡單 | 3/4 | 91.1% | 1791 ms | rare_word ×7、http_503 ×1、missing_target ×1 |
| gemini-3.5-flash-lite | 普通 | 3/4 | 90% | 1942 ms | rare_word ×4、missing_target ×3、length ×2、http_503 ×1 |
| gemini-3.5-flash-lite | 困難 | 1/4 | 100% | 2435 ms | http_503 ×3 |
| gemini-3.5-flash-lite | 常見弱點 | 3/6 | 96.7% | 1645 ms | rare_word ×3、http_503 ×3 |
| gemini-3.5-flash-lite | 罕見弱點 | 4/6 | 88.3% | 2466 ms | rare_word ×8、missing_target ×4、length ×2、http_503 ×2 |
| openai/gpt-oss-120b | 簡單 | 4/4 | 79.5% | 1928 ms | rare_word ×22、missing_target ×1、duplicate ×1 |
| openai/gpt-oss-120b | 普通 | 4/4 | 85% | 3456 ms | rare_word ×15、missing_target ×2、banned_word ×1 |
| openai/gpt-oss-120b | 困難 | 4/4 | 84.2% | 2516 ms | rare_word ×18、bad_chars ×1 |
| openai/gpt-oss-120b | 常見弱點 | 6/6 | 84.4% | 2531 ms | rare_word ×25、missing_target ×2、banned_word ×1 |
| openai/gpt-oss-120b | 罕見弱點 | 6/6 | 81.4% | 2736 ms | rare_word ×30、duplicate ×1、missing_target ×1、bad_chars ×1 |

### 每個案例

| 難度 | 主題 | 弱點 | 類型 | 模型 | 結果 | 合格／原始 | 延遲 | 主要原因 | 題目範例 |
|---|---|---|---|---|---|---|---|---|---|
| 簡單 | daily | `e` `r` `t` | 常見 | gemini | ✓ | 29／30 | 1999 ms | rare_word | `tree` `tent` `true` `tire` `team` `test` |
| 簡單 | daily | `e` `r` `t` | 常見 | groq | ✓ | 21／30 | 926 ms | rare_word | `tree` `rest` `tire` `rent` `term` `rate` |
| 簡單 | school | `in` `th` | 常見 | gemini | ✗ | 0／0 | 1434 ms | http_503 | — |
| 簡單 | school | `in` `th` | 常見 | groq | ✓ | 29／30 | 2065 ms | missing_target | `think` `thin` `thing` `this` `that` `math` |
| 簡單 | fantasy | `q` `x` `z` | 罕見 | gemini | ✓ | 25／30 | 1549 ms | rare_word | `axe` `quiz` `zone` `zero` `maze` `quartz` |
| 簡單 | fantasy | `q` `x` `z` | 罕見 | groq | ✓ | 21／30 | 2376 ms | rare_word | `quiz` `quest` `quick` `quiet` `quartz` `zebra` |
| 簡單 | space | `j` `k` `v` | 罕見 | gemini | ✓ | 28／30 | 2180 ms | rare_word | `jet` `jump` `joke` `jug` `jaw` `joy` |
| 簡單 | space | `j` `k` `v` | 罕見 | groq | ✓ | 22／27 | 2345 ms | rare_word | `jet` `jive` `jolly` `vibe` `vast` `move` |
| 普通 | space | `e` `r` `t` | 常見 | gemini | ✓ | 28／30 | 134 ms | rare_word | `earth` `orbit` `enter` `route` `timer` `react` |
| 普通 | space | `e` `r` `t` | 常見 | groq | ✓ | 23／30 | 3544 ms | rare_word | `planet` `rocket` `meteor` `asteroid` `comet` `orbit` |
| 普通 | daily | `in` `th` | 常見 | gemini | ✗ | 0／0 | 1367 ms | http_503 | — |
| 普通 | daily | `in` `th` | 常見 | groq | ✓ | 28／30 | 2660 ms | missing_target | `thing` `within` `thirty` `knitting` `month` `hinting` |
| 普通 | school | `q` `x` `z` | 罕見 | gemini | ✓ | 26／30 | 2035 ms | length | `zebra` `excel` `maximize` `liquid` `quartz` `dozen` |
| 普通 | school | `q` `x` `z` | 罕見 | groq | ✓ | 25／30 | 3807 ms | rare_word | `quizzes` `quiet` `quota` `squeeze` `exams` `extra` |
| 普通 | fantasy | `j` `k` `v` | 罕見 | gemini | ✓ | 27／30 | 4231 ms | missing_target | `jungle` `knight` `vivid` `major` `token` `value` |
| 普通 | fantasy | `j` `k` `v` | 罕見 | groq | ✓ | 26／30 | 3812 ms | rare_word | `jackal` `joker` `jungle` `juice` `jagged` `knight` |
| 困難 | fantasy | `e` `r` `t` | 常見 | gemini | ✓ | 30／30 | 3505 ms | — | `the green tree` `defeat the troll` `enter the gate` `retrieval quest` `terrible storm` `treat the injury` |
| 困難 | fantasy | `e` `r` `t` | 常見 | groq | ✓ | 28／30 | 2414 ms | rare_word | `Enter the tower` `Treasure hidden deep` `Rest at the inn` `Rogue steals treasure` `The brave knight` `Quiet forest trek` |
| 困難 | space | `ou` `th` | 常見 | gemini | ✗ | 0／0 | 1431 ms | http_503 | — |
| 困難 | space | `ou` `th` | 常見 | groq | ✓ | 23／30 | 3578 ms | rare_word | `through the nebula` `outward thrust launch` `the quiet orbit` `fourth star route` `bright south horizon` `through unknown void` |
| 困難 | daily | `q` `x` `z` | 罕見 | gemini | ✗ | 0／0 | 2309 ms | http_503 | — |
| 困難 | daily | `q` `x` `z` | 罕見 | groq | ✓ | 26／30 | 873 ms | rare_word | `Quick fox jumps` `Quiz night fun` `Zebra crossing ahead` `Exact quiz score` `Lazy zebra stroll` `Box of crayons` |
| 困難 | school | `4` `;` `th` | 罕見 | gemini | ✗ | 0／0 | 2493 ms | http_503 | — |
| 困難 | school | `4` `;` `th` | 罕見 | groq | ✓ | 24／30 | 3200 ms | rare_word | `Read the fourth page` `Lunch break; homework` `Thick math book` `Science lab; experiments` `Write the theme essay` `Group work; share ideas` |

## prompt v1（驗證規則：基本＋常用字）

執行時間：2026-11-16T14:55:07.484Z　每次呼叫的逾時：8000 ms

### 依難度與弱點類型

| 模型 | 分組 | 案例合格率 | 題目合格率 | 平均延遲 | 不合格原因分布 |
|---|---|---|---|---|---|
| gemini-3.5-flash-lite | 簡單 | 3/4 | 85.6% | 2387 ms | rare_word ×11、http_503 ×1、missing_target ×1、banned_word ×1 |
| gemini-3.5-flash-lite | 普通 | 3/4 | 90% | 2455 ms | rare_word ×6、length ×3、http_503 ×1 |
| gemini-3.5-flash-lite | 困難 | 0/4 | 46.7% | 1778 ms | rare_word ×11、banned_word ×5、http_503 ×3 |
| gemini-3.5-flash-lite | 常見弱點 | 3/6 | 82.5% | 2038 ms | rare_word ×12、banned_word ×5、length ×3、http_503 ×2、missing_target ×1 |
| gemini-3.5-flash-lite | 罕見弱點 | 3/6 | 81.1% | 2375 ms | rare_word ×16、http_503 ×3、banned_word ×1 |
| openai/gpt-oss-120b | 簡單 | 3/4 | 81.6% | 2050 ms | rare_word ×10、duplicate ×5、missing_target ×1、http_400 ×1 |
| openai/gpt-oss-120b | 普通 | 2/4 | 76.7% | 2847 ms | rare_word ×13、http_400 ×2、missing_target ×1 |
| openai/gpt-oss-120b | 困難 | 3/4 | 70.8% | 2708 ms | rare_word ×23、length ×12 |
| openai/gpt-oss-120b | 常見弱點 | 5/6 | 83.9% | 2799 ms | rare_word ×17、duplicate ×5、missing_target ×2、http_400 ×1 |
| openai/gpt-oss-120b | 罕見弱點 | 3/6 | 65.3% | 2271 ms | rare_word ×29、length ×12、http_400 ×2 |

### 每個案例

| 難度 | 主題 | 弱點 | 類型 | 模型 | 結果 | 合格／原始 | 延遲 | 主要原因 | 題目範例 |
|---|---|---|---|---|---|---|---|---|---|
| 簡單 | daily | `e` `r` `t` | 常見 | gemini | ✗ | 0／0 | 1830 ms | http_503 | — |
| 簡單 | daily | `e` `r` `t` | 常見 | groq | ✓ | 22／30 | 1004 ms | duplicate | `tree` `rest` `tire` `rent` `term` `tear` |
| 簡單 | school | `in` `th` | 常見 | gemini | ✓ | 29／30 | 1746 ms | missing_target | `thin` `this` `that` `than` `them` `then` |
| 簡單 | school | `in` `th` | 常見 | groq | ✓ | 26／29 | 3283 ms | rare_word | `think` `thin` `thing` `math` `that` `them` |
| 簡單 | fantasy | `q` `x` `z` | 罕見 | gemini | ✓ | 26／30 | 3134 ms | rare_word | `aqua` `quiz` `fuzz` `jazz` `daze` `maze` |
| 簡單 | fantasy | `q` `x` `z` | 罕見 | groq | ✗ | 0／0 | 2630 ms | http_400 | — |
| 簡單 | space | `j` `k` `v` | 罕見 | gemini | ✓ | 22／30 | 2838 ms | rare_word | `jet` `jar` `joy` `jig` `jug` `jaw` |
| 簡單 | space | `j` `k` `v` | 罕見 | groq | ✓ | 23／28 | 1284 ms | rare_word | `jive` `jack` `junk` `vibe` `lava` `navy` |
| 普通 | space | `e` `r` `t` | 常見 | gemini | ✓ | 27／30 | 2413 ms | length | `earth` `rocket` `orbit` `meteor` `rover` `sector` |
| 普通 | space | `e` `r` `t` | 常見 | groq | ✗ | 0／0 | 2745 ms | http_400 | — |
| 普通 | daily | `in` `th` | 常見 | gemini | ✓ | 29／30 | 1910 ms | length | `thing` `think` `third` `three` `throw` `month` |
| 普通 | daily | `in` `th` | 常見 | groq | ✓ | 24／30 | 2976 ms | rare_word | `within` `thing` `think` `thinly` `nothing` `author` |
| 普通 | school | `q` `x` `z` | 罕見 | gemini | ✗ | 0／0 | 2939 ms | http_503 | — |
| 普通 | school | `q` `x` `z` | 罕見 | groq | ✗ | 0／0 | 2504 ms | http_400 | — |
| 普通 | fantasy | `j` `k` `v` | 罕見 | gemini | ✓ | 25／30 | 2556 ms | rare_word | `vivid` `knife` `major` `valor` `voyage` `jukebox` |
| 普通 | fantasy | `j` `k` `v` | 罕見 | groq | ✓ | 22／30 | 3164 ms | rare_word | `jacket` `jungle` `knave` `velvet` `joker` `village` |
| 困難 | fantasy | `e` `r` `t` | 常見 | gemini | ✗ | 14／30 | 2405 ms | rare_word | — |
| 困難 | fantasy | `e` `r` `t` | 常見 | groq | ✓ | 26／30 | 2892 ms | rare_word | `Enter the forest` `Forgotten treasure map` `Silent river mist` `Eternal night quest` `Restoring ancient rite` `Treasure beyond the reef` |
| 困難 | space | `ou` `th` | 常見 | gemini | ✗ | 0／0 | 1923 ms | http_503 | — |
| 困難 | space | `ou` `th` | 常見 | groq | ✓ | 27／30 | 3895 ms | rare_word | `Through the nebula` `Out beyond the stars` `Launch thrust sequence` `Orbiting the moon` `Rough asteroid field` `Southern horizon view` |
| 困難 | daily | `q` `x` `z` | 罕見 | gemini | ✗ | 0／0 | 966 ms | http_503 | — |
| 困難 | daily | `q` `x` `z` | 罕見 | groq | ✓ | 22／30 | 1473 ms | rare_word | `Quick fox jumps` `Exact quiz results` `Boxed quartz gems` `Lazy zebra crossing` `Quick mix of juice` `Exact zip code` |
| 困難 | school | `4` `;` `th` | 罕見 | gemini | ✗ | 0／0 | 1816 ms | http_503 | — |
| 困難 | school | `4` `;` `th` | 罕見 | groq | ✗ | 10／30 | 2570 ms | length | — |

## prompt v1（驗證規則：基本）

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
