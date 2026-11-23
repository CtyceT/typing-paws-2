// 主題字白名單（D73）：這些字不受常用字檢查（rare_word）限制。
// 2 萬字常用字表來自電影字幕的詞頻，太空、奇幻這類主題字常常不在表上，但很適合當特訓題目。
// 規則：全小寫英文字母、國中生看得懂、適合闔家觀賞；複數、過去式等變化由 common.ts 一起處理（asteroids、enchanted）。
import type { TrainingTheme } from './request.ts'

const words = (s: string): ReadonlySet<string> => new Set(s.trim().split(/\s+/))

/**
 * 全主題通用的放行清單（D73 之後補的，2026-11-23）：
 * 1. 星期與月份：字表的來源字典把它們當專有名詞（大寫開頭），所以全部不在常用字表上。
 * 2. 評估中被誤判為冷僻字的正常字。
 */
export const EXTRA_WORDS: ReadonlySet<string> = words(`
  monday tuesday wednesday thursday friday saturday sunday
  january february march april may june july august september october november december
  pixel kayak thicken javelin ember thunderous southward xylophone zany zippy doze max theorem jovial syntax inlet
`)

export const THEME_WORDS: Readonly<Record<TrainingTheme, ReadonlySet<string>>> = {
  space: words(`
    space planet star moon sun orbit comet galaxy nebula asteroid meteor meteorite rocket astronaut alien satellite
    telescope gravity universe cosmos cosmic crater eclipse lunar solar stellar launch shuttle spaceship spacecraft
    starship mars jupiter saturn venus mercury neptune uranus pluto quasar pulsar supernova zenith horizon oxygen
    capsule module rover probe countdown
  `),
  fantasy: words(`
    wizard witch dragon knight castle kingdom princess prince queen king magic magical spell potion wand sword shield
    armor quest hero treasure crown throne tower dungeon goblin troll elf dwarf giant fairy unicorn griffin phoenix
    sorcerer enchant scroll rune relic legend myth beast gem jewel cave realm villain
  `),
  school: words(`
    classroom teacher student lesson homework exam quiz test grade pencil eraser notebook textbook backpack ruler
    crayon marker chalk whiteboard desk locker library librarian principal recess lunch cafeteria science math history
    geography art music gym project essay report spelling vocabulary alphabet semester diploma campus dictionary
    calculator scissors glue classmate
  `),
  daily: words(`
    breakfast lunch dinner kitchen bedroom bathroom shower toothbrush toothpaste pillow blanket sofa couch laundry
    grocery market sandwich cereal juice coffee tea pizza noodle bicycle bus subway umbrella jacket sweater sneakers
    wallet phone laptop keyboard weekend neighbor picnic puppy kitten garden vacuum fridge microwave napkin yogurt
    pancake cookie chores alarm mailbox
  `),
}
