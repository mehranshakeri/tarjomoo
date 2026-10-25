import { useState } from 'react'
import type { TranslationParams } from '@/hooks/useTranslationParams'

const LANGUAGES = [
  'Abkhazian', 'Afar', 'Afrikaans', 'Akan', 'Albanian', 'Amharic', 'Arabic', 'Aragonese',
  'Armenian', 'Assamese', 'Avaric', 'Avestan', 'Aymara', 'Azerbaijani', 'Bambara', 'Bashkir',
  'Basque', 'Belarusian', 'Bengali', 'Bihari languages', 'Bislama', 'Bosnian', 'Breton',
  'Bulgarian', 'Burmese', 'Catalan, Valencian', 'Chamorro', 'Chechen', 'Chichewa, Chewa, Nyanja',
  'Chinese', 'Chuvash', 'Cornish', 'Corsican', 'Cree', 'Croatian', 'Czech', 'Danish',
  'Divehi, Dhivehi, Maldivian', 'Dutch, Flemish', 'Dzongkha', 'English', 'Esperanto', 'Estonian',
  'Ewe', 'Faroese', 'Fijian', 'Finnish', 'French', 'Fulah', 'Galician', 'Georgian', 'German',
  'Greek, Modern', 'Guarani', 'Gujarati', 'Haitian, Haitian Creole', 'Hausa', 'Hebrew', 'Herero',
  'Hindi', 'Hiri Motu', 'Hungarian', 'Interlingua', 'Indonesian', 'Interlingue, Occidental',
  'Irish', 'Igbo', 'Inupiaq', 'Ido', 'Icelandic', 'Italian', 'Inuktitut', 'Japanese', 'Javanese',
  'Kalaallisut, Greenlandic', 'Kannada', 'Kanuri', 'Kashmiri', 'Kazakh', 'Central Khmer',
  'Kikuyu, Gikuyu', 'Kinyarwanda', 'Kirghiz, Kyrgyz', 'Komi', 'Kongo', 'Korean',
  'Kuanyama, Kwanyama', 'Kurdish', 'Lao', 'Latin', 'Latvian', 'Limburgan, Limburger, Limburgish',
  'Lingala', 'Lithuanian', 'Luxembourgish, Letzeburgesch', 'Luba-Katanga', 'Ganda', 'Macedonian',
  'Malagasy', 'Malay', 'Malayalam', 'Maltese', 'Maori', 'Marathi', 'Marshallese', 'Mongolian',
  'Nauru', 'Navajo, Navaho', 'North Ndebele', 'Nepali', 'Ndonga', 'Norwegian',
  'Norwegian Bokmål', 'Norwegian Nynorsk', 'Sichuan Yi, Nuosu', 'South Ndebele', 'Occitan',
  'Ojibwa', 'Church Slavic, Old Slavonic, Church Slavonic', 'Oromo', 'Oriya', 'Ossetian, Ossetic',
  'Panjabi, Punjabi', 'Pali', 'Persian/Farsi', 'Polish', 'Pashto, Pushto', 'Portuguese', 'Quechua',
  'Romansh', 'Romanian, Moldavian, Moldovan', 'Rundi', 'Russian', 'Sango', 'Sanskrit',
  'Sardinian', 'Serbian', 'Shona', 'Sindhi', 'Sinhala, Sinhalese', 'Slovak', 'Slovenian',
  'Somali', 'Sotho, Southern', 'Spanish, Castilian', 'Sundanese', 'Swahili', 'Swati', 'Swedish',
  'Tagalog', 'Tahitian', 'Tajik', 'Tamil', 'Tatar', 'Telugu', 'Thai', 'Tibetan', 'Tigrinya',
  'Tonga', 'Tsonga', 'Tswana', 'Turkish', 'Turkmen', 'Twi', 'Uighur, Uyghur', 'Ukrainian',
  'Urdu', 'Uzbek', 'Venda', 'Vietnamese', 'Volapük', 'Walloon', 'Welsh', 'Wolof',
  'Western Frisian', 'Xhosa', 'Yiddish', 'Yoruba', 'Zhuang, Chuang', 'Zulu',
]
const TONES = [
  'Professional & Business',
  'Academic & Scholarly',
  'Scientific',
  'Technical',
  'Accurate',
  'Fluid, accessible',
  'Professional',
  'Engaging',
  'Casual & Conversational',
  'Persuasive & Copywriting',
  'Creative & Narrative',
  'Instructional & How-To',
  'Empathetic & Supportive',
  'Authoritative & Thought Leadership',
  'Humorous & Witty',
]

interface Props {
  params: TranslationParams
  onConfirm: (params: TranslationParams) => void
  onClose: () => void
}

export function TranslationParamsModal({ params, onConfirm, onClose }: Props) {
  const [sourceLang, setSourceLang] = useState(params.sourceLang)
  const [targetLang, setTargetLang] = useState(params.targetLang)
  const [tones, setTones] = useState<string[]>(params.tones.length > 0 ? params.tones : ['Normal'])

  function toggleTone(tone: string) {
    setTones((prev) => {
      if (prev.includes(tone)) {
        const next = prev.filter((t) => t !== tone)
        return next.length === 0 ? prev : next
      }
      return [...prev, tone]
    })
  }

  function handleConfirm() {
    onConfirm({
      sourceLang: sourceLang.trim() || params.sourceLang,
      targetLang: targetLang.trim() || params.targetLang,
      tones,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Translation settings</h2>
          <button
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <datalist id="lang-list">
          {LANGUAGES.map((l) => <option key={l} value={l} />)}
        </datalist>

        {/* Languages — one row */}
        <div className="flex gap-3 items-end">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <label htmlFor="source-lang" className="text-sm font-medium text-foreground/70">Source</label>
            <input
              id="source-lang"
              type="text"
              list="lang-list"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              placeholder="e.g. English"
              className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              autoComplete="off"
            />
          </div>
          <div className="pb-2 text-foreground/30 text-sm shrink-0">→</div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <label htmlFor="target-lang" className="text-sm font-medium text-foreground/70">Target</label>
            <input
              id="target-lang"
              type="text"
              list="lang-list"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              placeholder="e.g. Persian"
              className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Tone */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground/70">Tone</span>
          <div className="flex flex-wrap gap-2">
            {TONES.map((tone) => {
              const selected = tones.includes(tone)
              return (
                <button
                  key={tone}
                  type="button"
                  onClick={() => toggleTone(tone)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selected
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-foreground/20 text-foreground/60 hover:border-foreground/40 hover:text-foreground'
                  }`}
                >
                  {tone}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-foreground/40">Select one or more</p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg text-foreground/50 hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!sourceLang.trim() || !targetLang.trim()}
            className="text-sm px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start translation
          </button>
        </div>
      </div>
    </div>
  )
}
