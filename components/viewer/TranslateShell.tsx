'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { OcrExport, TranslatedParagraph, OcrPageData, SanitizedPage, SanitizedBlock, ParagraphMerge } from '@/lib/types'
import { buildOcrExport, downloadOcrJson } from '@/lib/ocrExport'
import { downloadDocx } from '@/lib/docxExport'
import { useGeminiKey } from '@/hooks/useGeminiKey'
import { GeminiSettings } from '@/components/GeminiSettings'
import { useTranslationParams, type TranslationParams } from '@/hooks/useTranslationParams'
import { TranslationParamsModal } from '@/components/TranslationParamsModal'
import { GlossaryPanel } from '@/components/GlossaryPanel'
import { useGlossary } from '@/hooks/useGlossary'
import { translate, warmUp, type ModelSwitchNotification } from '@/lib/translationEngine'
import { PARAGRAPH_SEP } from '@/lib/translationPrompt'
import { SanitizePreviewPanel } from './SanitizePreviewPanel'
import { TranslationFlowPanel } from './TranslationFlowPanel'
import { PhaseBar } from '@/components/PhaseBar'

const RTL_LANGS = new Set([
  'Persian/Farsi', 'Arabic', 'Hebrew', 'Urdu',
  'Pashto, Pushto', 'Sindhi', 'Kashmiri', 'Uyghur', 'Uighur, Uyghur',
  'Kurdish', 'Yiddish', 'Divehi, Dhivehi, Maldivian', 'Thaana',
])

interface Props {
  ocrData: OcrExport
  params: TranslationParams
  sanitizedPages: Map<number, SanitizedPage>
  onReset: () => void
}

function compareParaKeys(a: string, b: string): number {
  const [ap, ab] = a.split('-').map(Number)
  const [bp, bb] = b.split('-').map(Number)
  return ap !== bp ? ap - bp : ab - bb
}

// Replays a list of merges on top of a sanitizedPages map, returning a new map.
function applyMerges(
  base: Map<number, SanitizedPage>,
  merges: ParagraphMerge[],
): Map<number, SanitizedPage> {
  const result = new Map(Array.from(base.entries()).map(([k, v]) => [k, { ...v, blocks: [...v.blocks] }]))
  for (const merge of merges) {
    const survivingPageIdx = parseInt(merge.survivingKey.split('-')[0], 10)
    const removedPageIdx = parseInt(merge.removedKey.split('-')[0], 10)
    const survivingPage = result.get(survivingPageIdx)
    const removedPage = result.get(removedPageIdx)
    if (!survivingPage || !removedPage) continue
    // Update surviving block's text
    survivingPage.blocks = survivingPage.blocks.map((b) =>
      b.paragraphKey === merge.survivingKey ? { ...b, text: merge.mergedText } : b
    )
    // Remove the absorbed block from its page
    removedPage.blocks = removedPage.blocks.filter((b) => b.paragraphKey !== merge.removedKey)
    if (survivingPageIdx !== removedPageIdx) {
      result.set(removedPageIdx, { ...removedPage })
    }
    result.set(survivingPageIdx, { ...survivingPage })
  }
  return result
}

export function TranslateShell({ ocrData, params, sanitizedPages, onReset }: Props) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [translations, setTranslations] = useState<Map<string, TranslatedParagraph>>(() => {
    const map = new Map<string, TranslatedParagraph>()
    for (const t of ocrData.translations ?? []) map.set(t.paragraphKey, t)
    return map
  })
  const [translating, setTranslating] = useState<Set<string>>(new Set())
  const [translationErrors, setTranslationErrors] = useState<Map<string, string>>(new Map())
  const [modelNotice, setModelNotice] = useState<ModelSwitchNotification | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showParams, setShowParams] = useState(false)
  const [showGlossary, setShowGlossary] = useState(false)
  const [downloadingDocx, setDownloadingDocx] = useState(false)
  const [merges, setMerges] = useState<ParagraphMerge[]>(() => ocrData.merges ?? [])
  const [localSanitizedPages, setLocalSanitizedPages] = useState<Map<number, SanitizedPage>>(() =>
    applyMerges(sanitizedPages, ocrData.merges ?? [])
  )
  const [mergeAnchor, setMergeAnchor] = useState<{ x: number; y: number } | null>(null)
  const { apiKey, setApiKey } = useGeminiKey()
  const { text: glossaryText, save: saveGlossary } = useGlossary()
  const glossaryTextRef = useRef(glossaryText)
  glossaryTextRef.current = glossaryText
  const { setParams } = useTranslationParams()
  const [activeParams, setActiveParams] = useState<TranslationParams>(params)

  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const isSyncingRef = useRef(false)

  const dir = RTL_LANGS.has(activeParams.targetLang) ? 'rtl' : 'ltr'

  // Warm up the Gemini connection as soon as key + params are known
  useEffect(() => {
    if (apiKey) warmUp(apiKey, activeParams.sourceLang, activeParams.targetLang, activeParams.tones)
  }, [apiKey, activeParams])

  // Scroll sync: track most-visible page in left panel → scroll right to match
  useEffect(() => {
    const left = leftRef.current
    if (!left) return
    const ratios = new Map<number, number>()
    const observers: IntersectionObserver[] = []
    const thresholds = Array.from({ length: 11 }, (_, k) => k / 10)

    ocrData.pages.forEach((p, i) => {
      const el = document.getElementById(`tr-sanitized-page-${i}`)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          ratios.set(i, entry.intersectionRatio)
          if (isSyncingRef.current) return
          let best = 0, bestRatio = -1
          ratios.forEach((r, idx) => { if (r > bestRatio) { bestRatio = r; best = idx } })
          const targetEl = document.getElementById(`tr-page-${ocrData.pages[best]?.pageIndex}`)
          if (!targetEl || !rightRef.current) return
          isSyncingRef.current = true
          targetEl.scrollIntoView({ block: 'start', behavior: 'smooth' })
          requestAnimationFrame(() => { isSyncingRef.current = false })
        },
        { threshold: thresholds, root: left },
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach((o) => o.disconnect())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrData.pages.length])

  // When selectedKeys changes, scroll both panels to the first selected block
  useEffect(() => {
    const firstKey = selectedKeys.values().next().value
    if (!firstKey) return
    const pageIndex = parseInt(firstKey.split('-')[0], 10)
    const leftEl = document.getElementById(`tr-sanitized-page-${pageIndex}`)
    const rightEl = document.getElementById(`tr-page-${pageIndex}`)
    leftEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    rightEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedKeys])

  const pageDataMapRef = useRef<Map<number, OcrPageData>>(
    new Map(ocrData.pages.map((p) => [p.pageIndex, p]))
  )

  // Build a flat key → SanitizedBlock lookup for deriving y when creating new translations
  const sanitizedBlockByKey = useMemo(() => {
    const map = new Map<string, SanitizedBlock>()
    for (const sp of localSanitizedPages.values()) {
      for (const b of sp.blocks) {
        if (b.paragraphKey) map.set(b.paragraphKey, b)
      }
    }
    return map
  }, [localSanitizedPages])

  // Flat ordered list of paragraph keys across all pages (page order → block order within page)
  const orderedParagraphKeys = useMemo(() => {
    const keys: string[] = []
    for (const p of ocrData.pages) {
      const sp = localSanitizedPages.get(p.pageIndex)
      if (!sp) continue
      for (const b of sp.blocks) {
        if (b.kind === 'paragraph' && b.paragraphKey) keys.push(b.paragraphKey)
      }
    }
    return keys
  }, [ocrData.pages, localSanitizedPages])

  const handleTranslate = useCallback(
    async (pageIndex: number, keys: string[], text: string, y: number) => {
      if (!apiKey) {
        setShowSettings(true)
        return
      }
      const primaryKey = keys[0]
      let alreadyInFlight = false
      setTranslating((prev) => {
        if (prev.has(primaryKey)) { alreadyInFlight = true; return prev }
        const next = new Set(prev)
        keys.forEach((k) => next.add(k))
        return next
      })
      await Promise.resolve()
      if (alreadyInFlight) return

      // Deselect immediately and scroll to the translation target
      setSelectedKeys(new Set())
      anchorKeyRef.current = null
      const leftEl = document.getElementById(`tr-sanitized-page-${pageIndex}`)
      const rightEl = document.getElementById(`tr-page-${pageIndex}`)
      leftEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      rightEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })

      setTranslationErrors((prev) => { const n = new Map(prev); n.delete(primaryKey); return n })

      // Create a placeholder entry for every key so each slot shows the spinner
      setTranslations((prev) => {
        const next = new Map(prev)
        keys.forEach((k, i) => {
          const block = sanitizedBlockByKey.get(k)
          next.set(k, {
            pageIndex: parseInt(k.split('-')[0], 10),
            paragraphKey: k,
            y: i === 0 ? y : (block?.y ?? y),
            text: '',
            sourceKeys: keys,
          })
        })
        return next
      })

      // Accumulate streaming chunks outside React state to avoid splitting a partial separator
      let buffer = ''

      try {
        await translate(
          apiKey,
          text,
          activeParams.sourceLang,
          activeParams.targetLang,
          activeParams.tones,
          (chunk) => {
            buffer += chunk
            // Stream live preview into the primary slot only
            setTranslations((prev) => {
              const existing = prev.get(primaryKey)
              if (!existing) return prev
              return new Map(prev).set(primaryKey, { ...existing, text: buffer })
            })
          },
          (notice) => setModelNotice(notice),
          glossaryTextRef.current || undefined,
        )

        // Split completed response and map 1:1 to keys
        const segments = buffer.split(PARAGRAPH_SEP)
        setTranslations((prev) => {
          const next = new Map(prev)
          if (segments.length === keys.length) {
            keys.forEach((k, i) => {
              const existing = prev.get(k)
              if (existing) next.set(k, { ...existing, text: segments[i].trim() })
            })
          } else {
            // Fallback: store full response in primary slot, clear secondary placeholders
            const existing = prev.get(primaryKey)
            if (existing) next.set(primaryKey, { ...existing, text: buffer.trim() })
            keys.slice(1).forEach((k) => next.delete(k))
          }
          return next
        })

      } catch (err) {
        setTranslations((prev) => {
          const next = new Map(prev)
          keys.forEach((k) => next.delete(k))
          return next
        })
        setTranslationErrors((prev) => new Map(prev).set(primaryKey, err instanceof Error ? err.message : 'Translation failed'))
      } finally {
        setTranslating((prev) => {
          const next = new Set(prev)
          keys.forEach((k) => next.delete(k))
          return next
        })
      }
    },
    [apiKey, activeParams, sanitizedBlockByKey],
  )

  const lastClickPosRef = useRef<{ x: number; y: number } | null>(null)
  const anchorKeyRef = useRef<string | null>(null)

  const handleSourceClickWithPosition = useCallback((key: string, multi: boolean, x: number, y: number) => {
    lastClickPosRef.current = { x, y }
    if (!multi) {
      // Plain click — set anchor, toggle single selection
      anchorKeyRef.current = key
      setSelectedKeys((prev) => prev.size === 1 && prev.has(key) ? new Set() : new Set([key]))
      return
    }
    // Shift-click — select the range from anchorKey to this key (inclusive)
    const anchor = anchorKeyRef.current
    if (!anchor || anchor === key) {
      anchorKeyRef.current = key
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
      return
    }
    const anchorIdx = orderedParagraphKeys.indexOf(anchor)
    const targetIdx = orderedParagraphKeys.indexOf(key)
    if (anchorIdx === -1 || targetIdx === -1) return
    const lo = Math.min(anchorIdx, targetIdx)
    const hi = Math.max(anchorIdx, targetIdx)
    setSelectedKeys(new Set(orderedParagraphKeys.slice(lo, hi + 1)))
  }, [orderedParagraphKeys])

  // Sync merge anchor: show only when exactly 2 adjacent paragraphs are selected
  useEffect(() => {
    if (selectedKeys.size === 2 && lastClickPosRef.current) {
      const [a, b] = [...selectedKeys]
      const ia = orderedParagraphKeys.indexOf(a)
      const ib = orderedParagraphKeys.indexOf(b)
      if (ia !== -1 && ib !== -1 && Math.abs(ia - ib) === 1) {
        setMergeAnchor(lastClickPosRef.current)
        return
      }
    }
    setMergeAnchor(null)
  }, [selectedKeys, orderedParagraphKeys])

  const handleSourceTranslate = useCallback((keys: string[]) => {
    const sorted = [...keys].sort(compareParaKeys)
    const primaryKey = sorted[0]
    const block = sanitizedBlockByKey.get(primaryKey)
    const pageIndex = parseInt(primaryKey.split('-')[0], 10)
    const text = sorted
      .map((k) => sanitizedBlockByKey.get(k)?.text ?? '')
      .filter(Boolean)
      .join(PARAGRAPH_SEP)
    handleTranslate(pageIndex, sorted, text, block?.y ?? 0)
  }, [sanitizedBlockByKey, handleTranslate])

  const handleEdit = useCallback((key: string, text: string) => {
    setTranslations((prev) => {
      const existing = prev.get(key)
      if (!existing) return prev
      return new Map(prev).set(key, { ...existing, text })
    })
  }, [])

  const handleSelectFromTranslation = useCallback((key: string) => {
    setSelectedKeys((prev) => prev.size === 1 && prev.has(key) ? new Set() : new Set([key]))
  }, [])

  const handleMerge = useCallback(() => {
    const keys = Array.from(selectedKeys).filter((k) => sanitizedBlockByKey.get(k)?.kind === 'paragraph')
    if (keys.length !== 2) return
    const sorted = [...keys].sort(compareParaKeys)
    const [survivingKey, removedKey] = sorted
    const survivingBlock = sanitizedBlockByKey.get(survivingKey)
    const removedBlock = sanitizedBlockByKey.get(removedKey)
    if (!survivingBlock || !removedBlock) return
    const mergedText = [survivingBlock.text, removedBlock.text].filter(Boolean).join(' ')
    const merge: ParagraphMerge = { survivingKey, removedKey, mergedText }
    const nextMerges = [...merges, merge]
    setMerges(nextMerges)
    setLocalSanitizedPages(applyMerges(sanitizedPages, nextMerges))
    // Drop any existing translations for both keys
    setTranslations((prev) => {
      const next = new Map(prev)
      next.delete(survivingKey)
      next.delete(removedKey)
      return next
    })
    setSelectedKeys(new Set())
    setMergeAnchor(null)
  }, [selectedKeys, sanitizedBlockByKey, merges, sanitizedPages])

  function handleDownload() {
    const exported = buildOcrExport(
      ocrData.fileName,
      ocrData.imageYLines,
      pageDataMapRef.current,
      ocrData.pages.length,
      translations,
      merges,
    )
    downloadOcrJson(exported)
  }

  async function handleDownloadDocx() {
    setDownloadingDocx(true)
    await downloadDocx(ocrData, localSanitizedPages, translations, dir)
    setDownloadingDocx(false)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Toolbar */}
      <header className="relative flex items-center justify-between px-5 py-3 border-b border-foreground/10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onReset}
            className="text-sm text-foreground/50 hover:text-foreground transition-colors flex items-center gap-1"
            aria-label="Upload a new file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            New file
          </button>
          <span className="text-sm text-foreground/60 truncate max-w-xs">{ocrData.fileName}</span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <PhaseBar activeStep={2} />
        </div>

        {/* Language pill — right group */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowParams(true)}
            className="flex items-center gap-1.5 text-xs text-foreground/50 bg-foreground/5 hover:bg-foreground/10 rounded-full px-3 py-1 transition-colors"
            title="Edit translation settings"
          >
            <span>{activeParams.sourceLang}</span>
            <span className="text-foreground/30">→</span>
            <span>{activeParams.targetLang}</span>
          </button>
          <button
            onClick={handleDownload}
            className="text-xs text-foreground/50 hover:text-foreground transition-colors px-2 py-1 rounded border border-foreground/15 hover:border-foreground/30"
          >
            Save JSON
          </button>
          <button
            onClick={handleDownloadDocx}
            disabled={downloadingDocx}
            className="text-xs px-3 py-1.5 bg-foreground text-background rounded hover:opacity-80 transition-opacity font-medium disabled:opacity-40"
          >
            {downloadingDocx ? 'Exporting…' : 'Download DOCX'}
          </button>
          <span className="text-xs text-foreground/40">
            {ocrData.pages.length} page{ocrData.pages.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowGlossary(true)}
            title="Glossary"
            className="text-foreground/40 hover:text-foreground transition-colors"
            aria-label="Glossary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(true)}
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
        </div>
      </header>

      {/* Split panels */}
      <div className="flex flex-1 min-h-0 divide-x divide-foreground/10">
        {/* Left — sanitized source */}
        <div ref={leftRef} className="flex-1 overflow-y-auto bg-white" aria-label="Sanitized">
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur px-4 py-2 border-b border-foreground/5">
            <span className="text-xs font-medium text-foreground/40 uppercase tracking-wider">Sanitized</span>
          </div>
          {ocrData.pages.map((p, i) => (
            <div key={p.pageIndex} id={`tr-sanitized-page-${i}`} className="border-b border-foreground/5">
              <SanitizePreviewPanel
                sanitizedPage={localSanitizedPages.get(p.pageIndex)}
                pageIndex={p.pageIndex}
                selectedKeys={selectedKeys}
                onSelectWithPosition={handleSourceClickWithPosition}
                onTranslate={(keys) => handleSourceTranslate(keys)}
              />
            </div>
          ))}
        </div>

        {/* Right — translation editor */}
        <div ref={rightRef} className="flex-1 overflow-y-auto bg-neutral-50" aria-label="Translation">
          <div className="sticky top-0 z-10 bg-neutral-50/80 backdrop-blur px-4 py-2 text-xs font-medium text-foreground/40 uppercase tracking-wider border-b border-foreground/5">
            Translation
          </div>
          <TranslationFlowPanel
            sanitizedPages={localSanitizedPages}
            pages={ocrData.pages}
            translations={translations}
            translating={translating}
            translationErrors={translationErrors}
            selectedKeys={selectedKeys}
            dir={dir}
            onSelect={handleSelectFromTranslation}
            onEdit={handleEdit}
          />
        </div>
      </div>

      {/* Floating Merge button — only when exactly 2 adjacent paragraphs are selected */}
      {mergeAnchor && (
        <button
          onClick={handleMerge}
          style={{ position: 'fixed', left: mergeAnchor.x + 12, top: mergeAnchor.y + 12, zIndex: 60 }}
          className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg shadow-lg hover:bg-amber-600 transition-colors font-medium pointer-events-auto"
        >
          Merge
        </button>
      )}

      {showGlossary && (
        <GlossaryPanel
          initialText={glossaryText}
          dir={dir}
          onClose={(text) => { saveGlossary(text); setShowGlossary(false) }}
        />
      )}

      {showSettings && (
        <GeminiSettings
          apiKey={apiKey}
          onSave={setApiKey}
          onDelete={() => setApiKey('')}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showParams && (
        <TranslationParamsModal
          params={activeParams}
          onConfirm={(next) => { setActiveParams(next); setParams(next); setShowParams(false) }}
          onClose={() => setShowParams(false)}
        />
      )}
      {modelNotice && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-4 py-2.5 shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>Model switched: <strong>{modelNotice.from}</strong> → <strong>{modelNotice.to}</strong></span>
          <button
            onClick={() => setModelNotice(null)}
            className="ml-1 text-amber-500 hover:text-amber-700 transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
