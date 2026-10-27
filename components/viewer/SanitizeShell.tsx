import { useState, useEffect, useCallback } from 'react'
import type { OcrExport, SanitizedPage } from '@/lib/types'
import { sanitizePage, type SanitizeOptions, DEFAULT_SANITIZE_OPTIONS } from '@/lib/sanitize'
import { IMAGE_Y_LINES_TO_OFFSET } from '@/lib/constants'
import { PageLoadingSpinner } from './PageLoadingSpinner'
import { SanitizeOcrPanel } from './SanitizeOcrPanel'
import { SanitizePreviewPanel } from './SanitizePreviewPanel'
import { PhaseBar } from '@/components/PhaseBar'
import { HeaderTools } from '@/components/HeaderTools'
import { GeminiSettings } from '@/components/GeminiSettings'
import { useGeminiKey } from '@/hooks/useGeminiKey'

interface Props {
  ocrData: OcrExport
  onComplete: (sanitizedPages: Map<number, SanitizedPage>) => void
}

export function SanitizeShell({ ocrData, onComplete }: Props) {
  const [noiseOverrides, setNoiseOverrides] = useState<Map<number, Set<number>>>(new Map())
  const [sanitizedPages, setSanitizedPages] = useState<Map<number, SanitizedPage>>(new Map())
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const { apiKey, setApiKey } = useGeminiKey()
  const [noiseOptions, setNoiseOptions] = useState<SanitizeOptions>(DEFAULT_SANITIZE_OPTIONS)

  const imageYOffset = ocrData.imageYLines * IMAGE_Y_LINES_TO_OFFSET
  const pages = ocrData.pages

  // Re-sanitize current page when options or overrides change
  useEffect(() => {
    const page = pages[currentPageIndex]
    if (!page) return
    const overrides = noiseOverrides.get(currentPageIndex) ?? new Set<number>()
    const result = sanitizePage(page, overrides, imageYOffset, noiseOptions)
    setSanitizedPages((prev) => new Map(prev).set(currentPageIndex, result))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageIndex, pages, noiseOverrides, noiseOptions])

  const handleNoiseOption = useCallback((key: keyof SanitizeOptions, value: number) => {
    setNoiseOptions((prev) => ({ ...prev, [key]: value }))
    // Invalidate all cached sanitized pages so they re-run with the new thresholds
    setSanitizedPages(new Map())
  }, [])

  const handleToggleNoise = useCallback((pageIndex: number, blockIndex: number) => {
    setNoiseOverrides((prev) => {
      const next = new Map(prev)
      const pageSet = new Set(next.get(pageIndex) ?? [])
      if (pageSet.has(blockIndex)) pageSet.delete(blockIndex)
      else pageSet.add(blockIndex)
      next.set(pageIndex, pageSet)
      return next
    })
  }, [])

  const handlePageChange = useCallback((pageIndex: number) => {
    setCurrentPageIndex(pageIndex)
  }, [])

  function handleContinue() {
    const missing = pages.filter((p) => !sanitizedPages.has(p.pageIndex))
    if (missing.length === 0) {
      onComplete(sanitizedPages)
      return
    }
    setCompleting(true)
    setCompletedCount(pages.length - missing.length)

    const accumulated = new Map(sanitizedPages)

    function processNext(remaining: typeof missing) {
      if (remaining.length === 0) {
        onComplete(accumulated)
        return
      }
      const [page, ...rest] = remaining
      const overrides = noiseOverrides.get(page.pageIndex) ?? new Set<number>()
      accumulated.set(page.pageIndex, sanitizePage(page, overrides, imageYOffset, noiseOptions))
      setCompletedCount(pages.length - rest.length)
      requestAnimationFrame(() => processNext(rest))
    }

    processNext(missing)
  }

  const ocrHeader = (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur px-4 py-2 border-b border-foreground/5 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-xs font-medium text-foreground/40 uppercase tracking-wider shrink-0">OCR</span>
      <label className="flex items-center gap-2 ml-auto text-xs text-foreground/50 shrink-0">
        Top noise
        <input
          type="range" min={0} max={0.4} step={0.01}
          value={noiseOptions.noiseThresholdTop}
          onChange={(e) => handleNoiseOption('noiseThresholdTop', Number(e.target.value))}
          className="w-20 accent-foreground/60"
        />
        <span className="w-8 text-right tabular-nums">{Math.round(noiseOptions.noiseThresholdTop * 100)}%</span>
      </label>
      <label className="flex items-center gap-2 text-xs text-foreground/50 shrink-0">
        Bottom noise
        <input
          type="range" min={0} max={0.4} step={0.01}
          value={noiseOptions.noiseThresholdBottom}
          onChange={(e) => handleNoiseOption('noiseThresholdBottom', Number(e.target.value))}
          className="w-20 accent-foreground/60"
        />
        <span className="w-8 text-right tabular-nums">{Math.round(noiseOptions.noiseThresholdBottom * 100)}%</span>
      </label>
    </div>
  )

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="relative flex items-center justify-between px-5 py-3 border-b border-foreground/10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground/60">Sanitize</span>
          <span className="text-xs text-foreground/40">
            {pages.length} page{pages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <PhaseBar activeStep={1} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleContinue}
            className="text-xs px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors font-medium"
          >
            Continue to Translate →
          </button>
          <HeaderTools apiKey={apiKey} onOpenSettings={() => setShowSettings(true)} />
        </div>
      </header>

      {/* Split panels */}
      <div className="flex flex-1 min-h-0 divide-x divide-foreground/10">
        {/* Left — OCR with noise highlighting */}
        <div className="w-1/2 overflow-y-auto bg-white" aria-label="OCR">
          {ocrHeader}
          <SanitizeOcrPanel
            pages={pages}
            imageYOffset={imageYOffset}
            noiseOverrides={noiseOverrides}
            noiseOptions={noiseOptions}
            onToggleNoise={handleToggleNoise}
            onPageChange={handlePageChange}
          />
        </div>

        {/* Right — sanitized preview, single page */}
        <div className="w-1/2 overflow-y-auto bg-neutral-50" aria-label="Sanitized">
          <div className="sticky top-0 z-10 bg-neutral-50/80 backdrop-blur px-4 py-2 border-b border-foreground/5">
            <span className="text-xs font-medium text-foreground/40 uppercase tracking-wider">
              Sanitized — page {currentPageIndex + 1}
            </span>
          </div>
          <SanitizePreviewPanel
            sanitizedPage={sanitizedPages.get(currentPageIndex)}
            pageIndex={currentPageIndex}
          />
        </div>
      </div>

      {/* Hint bar */}
      <div className="shrink-0 flex justify-center py-2.5 border-t border-foreground/5">
        <span className="px-4 py-1.5 rounded-lg border border-amber-300/50 bg-amber-100/40 text-sm text-amber-800/70">
          <strong>Shift+Click</strong> any text on the left to toggle noise removal.
        </span>
      </div>

      {/* Completion progress overlay */}
      {completing && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30">
          <PageLoadingSpinner label={`Sanitizing… ${completedCount} / ${pages.length} pages`} />
        </div>
      )}

      {showSettings && (
        <GeminiSettings
          apiKey={apiKey}
          onSave={(key) => { setApiKey(key); setShowSettings(false) }}
          onDelete={() => setApiKey('')}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
