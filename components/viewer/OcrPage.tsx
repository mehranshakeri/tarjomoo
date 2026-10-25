import { useState, useEffect, useMemo } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist'
import { usePageOcr } from '@/hooks/usePageOcr'
import { extractImageLayer } from '@/lib/extractImageLayer'
import { PageLoadingSpinner } from './PageLoadingSpinner'
import { PageImage } from './PageImage'
import { filterOcrBlocks } from '@/lib/ocrFilter'
import type { ImageBlock, OcrPageData } from '@/lib/types'
import { TEXT_SCALE } from '@/lib/constants'

interface Props {
  pageIndex: number
  page: PDFPageProxy | null
  canvas: HTMLCanvasElement | null
  widthPt: number
  heightPt: number
  enabled: boolean
  pageCount: number
  imageYOffset: number
  onReady?: (data: OcrPageData) => void
}

export function OcrPage({ pageIndex, page, canvas, widthPt, heightPt, enabled, pageCount, imageYOffset, onReady }: Props) {
  const { status, blocks: rawBlocks } = usePageOcr(page, canvas, enabled, pageCount)
  const [images, setImages] = useState<ImageBlock[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)

  const blocks = useMemo(
    () => filterOcrBlocks(rawBlocks, images, imageYOffset),
    [rawBlocks, images, imageYOffset],
  )

  useEffect(() => {
    if (!enabled || !page) return
    let cancelled = false
    setImagesLoading(true)
    extractImageLayer(page).then((imgs) => {
      if (!cancelled) {
        setImages(imgs)
        setImagesLoading(false)
      }
    }).catch(() => { if (!cancelled) setImagesLoading(false) })
    return () => { cancelled = true }
  }, [enabled, page])

  useEffect(() => {
    if (status !== 'done' || imagesLoading) return
    onReady?.({
      pageIndex,
      widthPt,
      heightPt,
      textBlocks: rawBlocks,
      imageBlocks: images,
    })
  // onReady intentionally excluded — callers should memoize it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, imagesLoading, rawBlocks, images, pageIndex, widthPt, heightPt])

  const aspectRatio = widthPt > 0 ? `${widthPt} / ${heightPt}` : '1 / 1.414'

  return (
    <div className="w-full bg-white" style={{ aspectRatio }}>
      {status !== 'done' ? (
        <PageLoadingSpinner label={status === 'processing' ? 'Extracting text…' : undefined} />
      ) : rawBlocks.length === 0 && images.length === 0 && !imagesLoading ? (
        <div className="flex items-center justify-center h-full text-xs text-foreground/30 py-12">
          No text found on this page
        </div>
      ) : (
        <div className="relative w-full h-full overflow-hidden">
          {images.map((img, i) => (
            <PageImage key={i} img={img} imageYOffset={imageYOffset} />
          ))}
          {blocks.map((b, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${b.x * 100}%`,
                top: `${b.y * 100}%`,
                fontSize: `${b.height * heightPt * TEXT_SCALE}px`,
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                color: '#111',
                fontFamily: 'var(--font-geist-sans), sans-serif',
              }}
            >
              {b.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
