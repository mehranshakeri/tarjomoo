'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  initialText: string
  dir: 'rtl' | 'ltr'
  onClose: (text: string) => void
}

export function GlossaryPanel({ initialText, dir, onClose }: Props) {
  const [text, setText] = useState(initialText)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  function handleClose() {
    onClose(text)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <>
      {/* Backdrop — click outside closes */}
      <div
        className="fixed inset-0 z-40"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col bg-white border-l border-foreground/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10 shrink-0">
          <span className="text-sm font-semibold text-foreground">Glossary</span>
          <div className="flex items-center gap-1">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              title="Copy glossary"
              className="p-1.5 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-colors"
              aria-label="Copy glossary"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                </svg>
              )}
            </button>
            {/* Close button */}
            <button
              onClick={handleClose}
              title="Close"
              className="p-1.5 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-colors"
              aria-label="Close glossary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Format hint */}
        <p className="px-4 pt-3 pb-1 text-xs text-foreground/40">
          One term per line: <code className="font-mono">Original:Translation</code>
        </p>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'hello:سلام\nAPI:رابط برنامه‌نویسی'}
          className={`flex-1 resize-none px-4 py-3 text-sm text-foreground bg-transparent outline-none placeholder:text-foreground/20${dir === 'rtl' ? ' [font-family:var(--font-arabic)]' : ' font-mono'}`}
          spellCheck={false}
        />
      </div>
    </>
  )
}
