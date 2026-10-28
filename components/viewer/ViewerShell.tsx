import { useRef, useState, useCallback, useEffect } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { PdfPanel } from './PdfPanel'
import { OcrPanel } from './OcrPanel'
import type { OcrExport, OcrPageData } from '@/lib/types'
import { buildOcrExport, downloadOcrJson } from '@/lib/ocrExport'
import { IMAGE_Y_LINES_TO_OFFSET } from '@/lib/constants'
import { syncScrollPanels } from '@/lib/scrollSync'
import { useGeminiKey } from '@/hooks/useGeminiKey'
import { HeaderTools } from '@/components/HeaderTools'
import { GeminiSettings } from '@/components/GeminiSettings'
import { useTranslationParams, hasStoredParams } from '@/hooks/useTranslationParams'
import { TranslationParamsModal } from '@/components/TranslationParamsModal'
import type { TranslationParams } from '@/hooks/useTranslationParams'
import { getPoolSize, getWorkerMax, setWorkerMax } from '@/lib/ocrEngine'
import { PhaseBar } from '@/components/PhaseBar'

interface Props {
  fileName: string
  pdfDoc: PDFDocumentProxy
  onReset: () => void
  onAdvance: (data: OcrExport, params: TranslationParams) => void
}

const OCR_INITIAL_BATCH = 5   // pages to process on load
const OCR_BATCH_SIZE = 5      // pages to add when approaching the frontier
const OCR_PREFETCH_AHEAD = 2  // trigger a new batch this many pages before the frontier

export function ViewerShell({ pdfDoc, fileName, onReset, onAdvance }: Props) {
  const [pages, setPages] = useState<PDFPageProxy[]>([])
  const [canvasMap, setCanvasMap] = useState<Map<number, HTMLCanvasElement>>(new Map())
  const [processedUpTo, setProcessedUpTo] = useState(OCR_INITIAL_BATCH)
  const [imageYLines, setImageYLines] = useState(0)
  const [ocrDoneCount, setOcrDoneCount] = useState(0)
  const [pendingAction, setPendingAction] = useState<'advance' | 'download' | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showParams, setShowParams] = useState(false)
  const { apiKey, setApiKey } = useGeminiKey()
  const { params, setParams } = useTranslationParams()

  const pageDataMapRef = useRef<Map<number, OcrPageData>>(new Map())
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const isSyncingRef = useRef(false)
  const pagesRef = useRef<PDFPageProxy[]>([])

  const [workerMax, setWorkerMaxState] = useState(getWorkerMax)
  const [poolSize, setPoolSize] = useState(0)

  // Poll pool size while OCR is running so the display stays current
  useEffect(() => {
    const id = setInterval(() => setPoolSize(getPoolSize()), 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { pagesRef.current = pages }, [pages])

  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false
    async function loadPages() {
      const loaded: PDFPageProxy[] = []
      for (let i = 1; i <= pdfDoc!.numPages; i++) {
        const page = await pdfDoc!.getPage(i)
        if (cancelled) return
        loaded.push(page)
        setPages([...loaded])
      }
    }
    loadPages()
    return () => { cancelled = true }
  }, [pdfDoc])

  const handleCanvasReady = useCallback((index: number, canvas: HTMLCanvasElement) => {
    setCanvasMap((prev) => {
      const next = new Map(prev)
      next.set(index, canvas)
      return next
    })
  }, [])

  const handlePageReady = useCallback((data: OcrPageData) => {
    pageDataMapRef.current.set(data.pageIndex, data)
    setOcrDoneCount(pageDataMapRef.current.size)
  }, [])

  const total = pdfDoc.numPages
  const ocrComplete = ocrDoneCount >= total

  function runDownload() {
    const exported = buildOcrExport(fileName, imageYLines, pageDataMapRef.current, total)
    downloadOcrJson(exported)
  }

  function runAdvance(nextParams: TranslationParams) {
    const exported = buildOcrExport(fileName, imageYLines, pageDataMapRef.current, total)
    onAdvance(exported, nextParams)
  }

  function handleDownload() {
    if (ocrComplete) { runDownload(); return }
    setProcessedUpTo(total - 1)
    setPendingAction('download')
  }

  function handleAdvance() {
    if (hasStoredParams()) { handleParamsConfirm(params); return }
    setShowParams(true)
  }

  function handleParamsConfirm(nextParams: TranslationParams) {
    setParams(nextParams)
    setShowParams(false)
    if (ocrComplete) { runAdvance(nextParams); return }
    pendingParamsRef.current = nextParams
    setProcessedUpTo(total - 1)
    setPendingAction('advance')
  }

  const pendingParamsRef = useRef<TranslationParams | null>(null)

  useEffect(() => {
    if (!pendingAction || !ocrComplete) return
    if (pendingAction === 'download') runDownload()
    if (pendingAction === 'advance' && pendingParamsRef.current) runAdvance(pendingParamsRef.current)
    setPendingAction(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction, ocrComplete])

  useEffect(() => {
    const left = leftRef.current
    const right = rightRef.current
    if (!left || !right || pages.length === 0) return

    function currentPageIndex(): number {
      const containerTop = left!.scrollTop
      const containerBottom = containerTop + left!.clientHeight
      let bestIdx = 0, bestVisible = 0
      for (let i = 0; i < pagesRef.current.length; i++) {
        const el = document.getElementById(`pdf-page-${i}`)
        if (!el) continue
        const elTop = el.offsetTop
        const elBottom = elTop + el.offsetHeight
        const visible = Math.max(0, Math.min(containerBottom, elBottom) - Math.max(containerTop, elTop))
        if (visible > bestVisible) { bestVisible = visible; bestIdx = i }
      }
      return bestIdx
    }

    const onLeftScroll = () => {
      syncScrollPanels(left, right, 'pdf', 'ocr', pagesRef.current.length, isSyncingRef)
      const current = currentPageIndex()
      setProcessedUpTo((prev) => {
        if (current >= prev - OCR_PREFETCH_AHEAD) return Math.min(prev + OCR_BATCH_SIZE, pagesRef.current.length - 1)
        return prev
      })
    }

    const onRightScroll = () => syncScrollPanels(right, left, 'ocr', 'pdf', pagesRef.current.length, isSyncingRef)

    left.addEventListener('scroll', onLeftScroll, { passive: true })
    right.addEventListener('scroll', onRightScroll, { passive: true })
    return () => {
      left.removeEventListener('scroll', onLeftScroll)
      right.removeEventListener('scroll', onRightScroll)
    }
  }, [pages])

  const ocrHeader = (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur px-4 py-2 border-b border-foreground/5 flex items-center gap-3">
      <span className="text-xs font-medium text-foreground/40 uppercase tracking-wider shrink-0">OCR / Text Layer</span>
      <label className="flex items-center gap-2 ml-auto text-xs text-foreground/50 shrink-0">
        Image offset
        <input
          type="range"
          min={-10}
          max={20}
          step={0.5}
          value={imageYLines}
          onChange={(e) => setImageYLines(Number(e.target.value))}
          className="w-24 accent-foreground/60"
        />
        <span className="w-8 text-right tabular-nums">{imageYLines}</span>
      </label>
    </div>
  )

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
          <span className="text-sm text-foreground/60 truncate max-w-xs">{fileName}</span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <PhaseBar activeStep={0} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAdvance}
            className="text-xs px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors font-medium"
          >
            Sanitize →
          </button>
          <button
            onClick={handleDownload}
            className="hidden text-xs text-foreground/50 hover:text-foreground transition-colors px-2 py-1 rounded border border-foreground/15 hover:border-foreground/30"
          >
            Save JSON
          </button>
          <span className="text-xs text-foreground/40">{total} page{total !== 1 ? 's' : ''}</span>
          <HeaderTools apiKey={apiKey} onOpenSettings={() => setShowSettings(true)} />
        </div>
      </header>

      <div className="flex flex-1 min-h-0 divide-x divide-foreground/10">
        <div
          ref={leftRef}
          className="flex-1 overflow-y-auto bg-neutral-100"
          aria-label="PDF original"
        >
          <div className="sticky top-0 z-10 bg-neutral-100/80 backdrop-blur px-4 py-2 text-xs font-medium text-foreground/40 uppercase tracking-wider border-b border-foreground/5">
            Original PDF
          </div>
          <PdfPanel pages={pages} onCanvasReady={handleCanvasReady} />
        </div>

        <div
          ref={rightRef}
          className="flex-1 overflow-y-auto bg-white"
          aria-label="OCR result"
        >
          {ocrHeader}
          <OcrPanel
            pages={pages}
            canvasMap={canvasMap}
            processedUpTo={processedUpTo}
            pageCount={total}
            imageYOffset={imageYLines * IMAGE_Y_LINES_TO_OFFSET}
            onPageReady={handlePageReady}
          />
        </div>
      </div>

      {showSettings && (
        <GeminiSettings
          apiKey={apiKey}
          onSave={(key) => { setApiKey(key); setShowSettings(false) }}
          onDelete={() => setApiKey('')}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showParams && (
        <TranslationParamsModal
          params={params}
          onConfirm={handleParamsConfirm}
          onClose={() => setShowParams(false)}
        />
      )}

      {/* OCR progress modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-80 flex flex-col items-center gap-5">
            <div className="text-sm font-medium text-foreground">
              {pendingAction === 'advance' ? 'Preparing translation…' : 'Preparing export…'}
            </div>
            <div className="text-xs text-foreground/50">
              Running OCR on remaining pages
            </div>

            {/* Progress bar */}
            <div className="w-full bg-foreground/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-foreground/70 h-2 rounded-full transition-all duration-300"
                style={{ width: `${total > 0 ? (ocrDoneCount / total) * 100 : 0}%` }}
              />
            </div>
            <div className="text-xs tabular-nums text-foreground/40">
              {ocrDoneCount} / {total} pages
            </div>

            {/* Workers slider */}
            <label className="flex items-center gap-3 w-full text-xs text-foreground/50">
              <span className="shrink-0">Workers</span>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={workerMax}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setWorkerMaxState(n)
                  setWorkerMax(n)
                }}
                className="flex-1 accent-foreground/60"
              />
              <span className="tabular-nums text-foreground/70 font-medium shrink-0">
                {poolSize}<span className="text-foreground/30">/{workerMax}</span>
              </span>
            </label>

            <button
              onClick={() => setPendingAction(null)}
              className="text-xs text-foreground/50 hover:text-foreground transition-colors px-4 py-1.5 rounded border border-foreground/20 hover:border-foreground/40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
