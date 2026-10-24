import { translateWithGemini, warmUpGemini, type ModelSwitchNotification } from './gemini'
import { buildSystemInstruction, buildTranslationPrompt, filterGlossary } from './translationPrompt'

export type { ModelSwitchNotification }

export function warmUp(apiKey: string, sourceLang: string, targetLang: string, tones: string[]): void {
  const systemInstruction = buildSystemInstruction(sourceLang, targetLang, tones)
  warmUpGemini(apiKey, systemInstruction)
}

export async function translate(
  apiKey: string,
  text: string,
  sourceLang: string,
  targetLang: string,
  tones: string[],
  onChunk: (chunk: string) => void,
  onModelSwitch?: (n: ModelSwitchNotification) => void,
  glossaryText?: string,
): Promise<void> {
  const filtered = glossaryText ? filterGlossary(glossaryText, text) : undefined
  const systemInstruction = buildSystemInstruction(sourceLang, targetLang, tones, filtered)
  const prompt = buildTranslationPrompt(text)
  return translateWithGemini(apiKey, systemInstruction, prompt, onChunk, onModelSwitch)
}
