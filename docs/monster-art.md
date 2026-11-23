# AI 怪物生圖指南（Typing Paws 2.0 階段 6）

## 一、圖片規格（給 Claude Code）

| 項目 | 規格 |
|---|---|
| 生成尺寸 | 1024×1024（SDXL 系）或 512×512（SD 1.5 系） |
| 最終檔案 | 512×512 PNG，**透明背景** |
| 構圖 | 一隻怪物、全身、置中，四周留約 10% 空白 |
| 朝向 | 面向**左邊**（遊戲裡怪物站在右側，面向勇者） |
| 檔名 | `monster-01.png` ～ `monster-12.png`（對照下方編號） |
| 位置 | 專案的 `assets/monsters/` |

去背做法：生圖時用**純白背景**，生完再用 `rembg` 去背（HuggingFace 上的開源去背模型，課堂學的工具鏈也用得到）：

```bash
pip install "rembg[cli]"
rembg i monster-01-raw.png monster-01.png
```

## 二、共用風格提示詞（每隻都要加）

目的是讓 12 隻怪物的畫風一致，並和遊戲裡的 SVG 勇者搭配（粗深紫外框、扁平色塊、可愛圓潤）。

**Positive（加在每隻怪物描述的後面）**
```
cute chibi monster, kawaii sticker style, thick dark purple outline, flat pastel colors,
simple rounded shapes, big round eyes, small body, full body, centered, facing left,
plain white background, game character sprite, clean vector-like illustration
```

**Negative**
```
realistic, photo, 3d render, scary, horror, gore, blood, weapon, text, letters, watermark,
signature, multiple characters, cropped, cut off, background scenery, shadow on ground,
gradient background, complex details
```

建議設定：
- 固定同一個 seed 範圍與 sampler，每隻生 4～8 張再挑最好的一張
- Fooocus 可以選 "Sticker" 或 "Flat" 類的風格預設，再加上上面的提示詞
- 顏色太雜或不夠可愛時，在 positive 加 `minimal, soft colors`

## 三、12 隻怪物

對應弱點特訓的 4 個主題，每個主題 2 隻小怪＋1 隻魔王。經典闖關可以從全部 12 隻裡抽。

| 編號 | 主題 | 怪物（暫名） | 描述提示詞（放在共用風格前面） |
|---|---|---|---|
| 01 | 日常 | 失蹤襪子怪 | `a mischievous striped sock monster with tiny arms` |
| 02 | 日常 | 賴床鬧鐘怪 | `a grumpy round alarm clock monster with two bells on its head` |
| 03 | 日常（魔王） | 髒衣服山大王 | `a big fluffy laundry pile monster wearing a sock as a crown` |
| 04 | 奇幻 | 果凍史萊姆 | `a bouncy green jelly slime monster with a leaf on top` |
| 05 | 奇幻 | 蘑菇小妖 | `a tiny red spotted mushroom imp with a mischievous smile` |
| 06 | 奇幻（魔王） | 小火龍 | `a chubby little purple dragon with small wings and a tiny flame` |
| 07 | 太空 | 果凍外星人 | `a small blue blob alien with one big eye and antenna` |
| 08 | 太空 | 隕石怪 | `a grumpy rocky meteor monster with small glowing cracks` |
| 09 | 太空（魔王） | 章魚艦長 | `a pink octopus alien captain wearing a tiny space helmet` |
| 10 | 校園 | 小 Bug 蟲 | `a small green beetle bug monster with tiny glasses` |
| 11 | 校園 | Typo 幽靈 | `a playful white ghost monster holding a pencil` |
| 12 | 校園（魔王） | Deadline 龍王 | `an orange dragon monster with a clock on its belly` |

10～12 是 1.0 版的三隻怪物（Bug 蟲、Typo 幽靈、Deadline 龍王），保留下來當作從作業五延續的彩蛋。

名字、台詞、弱點屬性之後交給 LLM 生成，這裡的中文名只是暫名。

## 四、挑圖標準

- 一眼看得出是什麼東西，縮小到 120px 還認得出來
- 外框粗、輪廓清楚，去背後邊緣乾淨
- 表情可愛，不恐怖
- 和勇者放在一起畫風不衝突（可以開遊戲截圖對照）
- 沒有文字、浮水印、多餘的手指或肢體

## 五、報告素材（順手記下來）

- 用的模型名稱與版本、生成工具（diffusers／Fooocus）
- 每隻怪物的最終提示詞、seed、生成張數
- 一張「同一個提示詞生出的 4 張候選圖」對照，說明為什麼選這張
- 去背前後對照
