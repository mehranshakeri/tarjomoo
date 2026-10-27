import { useState, type ReactNode } from 'react'
import { GlossaryPanel } from '@/components/GlossaryPanel'
import { useGlossary } from '@/hooks/useGlossary'
import { useTranslationParams } from '@/hooks/useTranslationParams'
import { RTL_LANGS } from '@/lib/constants'

interface Props {
  apiKey: string
  onOpenSettings: () => void
  /** Show the glossary button (translate screen only). */
  showGlossaryButton?: boolean
  /** Extra header items rendered between the glossary and settings buttons. */
  children?: ReactNode
}

/** Glossary + settings icons for the right side of a screen header. */
export function HeaderTools({ apiKey, onOpenSettings, showGlossaryButton = false, children }: Props) {
  const [showGlossary, setShowGlossary] = useState(false)
  const { text: glossaryText, save: saveGlossary } = useGlossary()
  const { params } = useTranslationParams()
  const dir = RTL_LANGS.has(params.targetLang) ? 'rtl' : 'ltr'

  return (
    <>
      {showGlossaryButton && (
        <button
          onClick={() => setShowGlossary(true)}
          title={glossaryText.trim() ? 'Glossary (has terms)' : 'Glossary'}
          className="relative flex items-center gap-1.5 text-xs text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-full px-3 py-1 transition-colors"
          aria-label="Glossary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
          Glossary
          {glossaryText.trim() && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-background" aria-hidden="true" />
          )}
        </button>
      )}
      {children}
      <button
        onClick={onOpenSettings}
        title={apiKey ? 'Translation settings (key configured)' : 'Set up translation'}
        className="text-foreground/40 hover:text-foreground transition-colors ml-1"
        aria-label="Translation settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        {apiKey && <span className="sr-only">(configured)</span>}
      </button>

      {showGlossary && (
        <GlossaryPanel
          initialText={glossaryText}
          dir={dir}
          sourceLang={params.sourceLang}
          targetLang={params.targetLang}
          onClose={(text) => { saveGlossary(text); setShowGlossary(false) }}
        />
      )}
    </>
  )
}
