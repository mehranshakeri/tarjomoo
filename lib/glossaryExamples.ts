// Example glossary terms ("hello" / "thank you") for the common languages, used
// to build a placeholder that matches the selected source/target pair.
const EXAMPLES: Record<string, [string, string]> = {
  'English': ['hello', 'thank you'],
  'Persian/Farsi': ['سلام', 'ممنون'],
  'Arabic': ['مرحبا', 'شكرا'],
  'Hebrew': ['שלום', 'תודה'],
  'Urdu': ['ہیلو', 'شکریہ'],
  'Turkish': ['merhaba', 'teşekkürler'],
  'French': ['bonjour', 'merci'],
  'German': ['hallo', 'danke'],
  'Spanish, Castilian': ['hola', 'gracias'],
  'Italian': ['ciao', 'grazie'],
  'Portuguese': ['olá', 'obrigado'],
  'Dutch, Flemish': ['hallo', 'dank je'],
  'Russian': ['привет', 'спасибо'],
  'Ukrainian': ['привіт', 'дякую'],
  'Polish': ['cześć', 'dziękuję'],
  'Chinese': ['你好', '谢谢'],
  'Japanese': ['こんにちは', 'ありがとう'],
  'Korean': ['안녕하세요', '감사합니다'],
  'Hindi': ['नमस्ते', 'धन्यवाद'],
  'Indonesian': ['halo', 'terima kasih'],
  'Greek, Modern': ['γεια', 'ευχαριστώ'],
  'Swedish': ['hej', 'tack'],
}

const shortName = (lang: string) => lang.split(',')[0].trim()

export function glossaryFormatHint(sourceLang: string, targetLang: string) {
  return `${shortName(sourceLang)}:${shortName(targetLang)}`
}

export function glossaryPlaceholder(sourceLang: string, targetLang: string): string {
  const src = EXAMPLES[sourceLang]
  const tgt = EXAMPLES[targetLang]
  if (!src || !tgt) {
    return `${shortName(sourceLang)} term:${shortName(targetLang)} term`
  }
  return src.map((s, i) => `${s}:${tgt[i]}`).join('\n')
}
