import { useEffect, useRef } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist'

const RENDER_SCALE = 3

interface Props {
  page: PDFPageProxy
  pageIndex: number
  onCanvasReady: (index: number, canvas: HTMLCanvasElement) => void
}

export function PdfPageCanvas({ page, pageIndex, onCanvasReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const viewport = page.getViewport({ scale: RENDER_SCALE })
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!

    const renderTask = page.render({ canvas, canvasContext: ctx, viewport })
    renderTask.promise.then(() => {
      onCanvasReady(pageIndex, canvas)
    }).catch(() => {/* cancelled on unmount */})

    return () => { renderTask.cancel() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageIndex])

  const viewport = page.getViewport({ scale: 1 })
  const aspectRatio = `${viewport.width} / ${viewport.height}`

  return (
    <canvas
      ref={canvasRef}
      id={`pdf-page-${pageIndex}`}
      className="w-full block"
      style={{ aspectRatio }}
    />
  )
}

interface PdfPanelProps {
  pages: PDFPageProxy[]
  onCanvasReady: (index: number, canvas: HTMLCanvasElement) => void
}

export function PdfPanel({ pages, onCanvasReady }: PdfPanelProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {pages.map((page, i) => (
        <PdfPageCanvas
          key={i}
          page={page}
          pageIndex={i}
          onCanvasReady={onCanvasReady}
        />
      ))}
    </div>
  )
}
