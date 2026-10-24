'use client'

import { useMemo } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist'
import { OcrPage } from './OcrPage'
import type { OcrPageData } from '@/lib/types'

interface Props {
  pages: PDFPageProxy[]
  canvasMap: Map<number, HTMLCanvasElement>
  processedUpTo: number
  pageCount: number
  imageYOffset: number
  onPageReady: (data: OcrPageData) => void
}

interface PageDimensions {
  widthPt: number
  heightPt: number
}

function usePageDimensions(pages: PDFPageProxy[]): PageDimensions[] {
  return useMemo(
    () => pages.map((page) => {
      const { width, height } = page.getViewport({ scale: 1 })
      return { widthPt: width, heightPt: height }
    }),
    [pages],
  )
}

export function OcrPanel({ pages, canvasMap, processedUpTo, pageCount, imageYOffset, onPageReady }: Props) {
  const dimensions = usePageDimensions(pages)

  return (
    <div className="flex flex-col gap-4 p-4">
      {pages.map((page, i) => (
        <div key={i} id={`ocr-page-${i}`}>
          <OcrPage
            pageIndex={i}
            page={page}
            canvas={canvasMap.get(i) ?? null}
            widthPt={dimensions[i]?.widthPt ?? 0}
            heightPt={dimensions[i]?.heightPt ?? 0}
            enabled={i <= processedUpTo}
            pageCount={pageCount}
            imageYOffset={imageYOffset}
            onReady={onPageReady}
          />
        </div>
      ))}
    </div>
  )
}
