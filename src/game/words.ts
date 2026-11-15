import type { Difficulty } from './difficulty.ts'

/** 字串是否非空且只含可列印 ASCII（0x20–0x7E）。內建字庫與 LLM 輸出驗證共用。 */
export function isPrintableAscii(text: string): boolean {
  return /^[\x20-\x7E]+$/.test(text)
}

/** 內建字庫。AI 出題失敗時也退回這裡。 */
export const WORDS: Readonly<Record<Difficulty, readonly string[]>> = {
  easy: [
    'cat', 'dog', 'sun', 'moon', 'star', 'cake', 'milk', 'fish', 'bird', 'tree', 'rain', 'snow', 'blue', 'pink', 'jump',
    'play', 'sing', 'nap', 'cup', 'hat', 'box', 'toy', 'egg', 'pie', 'bee', 'fox', 'owl', 'map', 'key', 'bus', 'red', 'joy',
    'hug', 'paw', 'fun', 'kite', 'leaf', 'wind', 'frog', 'duck', 'bear', 'rice', 'tea', 'home', 'soft', 'cozy',
  ],
  normal: [
    'banana', 'rabbit', 'purple', 'coffee', 'window', 'garden', 'rocket', 'planet', 'castle', 'dragon', 'cookie',
    'muffin', 'island', 'bubble', 'candle', 'pirate', 'wizard', 'jungle', 'orange', 'pencil', 'monkey', 'laptop', 'puzzle',
    'summer', 'winter', 'flower', 'button', 'kitten', 'travel', 'battle', 'shadow', 'silver', 'yellow', 'sunset', 'cheese',
    'dinosaur', 'keyboard', 'rainbow', 'picnic', 'penguin', 'cupcake', 'balloon',
  ],
  hard: [
    'fluffy kitten', 'Hello, World!', 'debug the code', 'midnight snack', 'keyboard warrior', 'strawberry',
    'adventure', 'programming', 'Thank you!', 'pineapple pizza', 'rainbow unicorn', 'deadline is near', 'commit & push',
    'coffee overflow', '404 not found', 'semicolon;', 'JavaScript', 'GitHub Pages', 'vibe coding', 'Taipei 101',
    'bubble tea', 'night market', 'typing master', 'Ctrl + C', 'spaghetti code', 'happy hacking', 'quantum cat',
    'marshmallow', 'butterfly effect', 'Monday morning', 'sunflower seeds', 'It works!',
  ],
}
