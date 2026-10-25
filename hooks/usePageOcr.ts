import { useState, useEffect } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist'
import type { PageStatus, TextBlock } from '@/lib/types'
import { recognizePage } from '@/lib/ocrEngine'

export function usePageOcr(
  page: PDFPageProxy | null,
  canvas: HTMLCanvasElement | null,
  enabled: boolean,
  pageCount: number,
) {
  const [status, setStatus] = useState<PageStatus>('pending')
  const [blocks, setBlocks] = useState<TextBlock[]>([])

  useEffect(() => {
    if (!enabled || !page || !canvas) return
    let cancelled = false

    async function run() {
      setStatus('processing')
      try {
        const ocrBlocks = await recognizePage(canvas!, pageCount)
        if (!cancelled) {
          setBlocks(ocrBlocks)
          setStatus('done')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    run()
    return () => { cancelled = true }
  }, [enabled, page, canvas, pageCount])

  return { status, blocks }
}
