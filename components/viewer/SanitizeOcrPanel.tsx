'use client'

import { useEffect, useRef, useMemo } from 'react'
import type { OcrPageData } from '@/lib/types'
import { detectNoise, applyNoiseOverrides, type SanitizeOptions } from '@/lib/sanitize'
import { overlapsImage } from '@/lib/ocrFilter'
import { TEXT_SCALE } from '@/lib/constants'
import { PageImage } from './PageImage'

interface Props {
  pages: OcrPageData[]
  imageYOffset: number
  noiseOverrides: Map<number, Set<number>>
  noiseOptions: SanitizeOptions
  onToggleNoise: (pageIndex: number, blockIndex: number) => void
  onPageChange: (pageIndex: number) => void
}

export function SanitizeOcrPanel({
  pages,
  imageYOffset,
  noiseOverrides,
  noiseOptions,
  onToggleNoise,
  onPageChange,
}: Props) {
  const ratiosRef = useRef<Map<number, number>>(new Map())

  const autoNoisePerPage = useMemo(
    () => pages.map((p) => detectNoise(p.textBlocks, noiseOptions)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, noiseOptions],
  )

  // IntersectionObserver: track which page has the highest visibility ratio
  useEffect(() => {
    const ratios = ratiosRef.current
    const observers: IntersectionObserver[] = []
    const thresholds = Array.from({ length: 11 }, (_, k) => k / 10)

    pages.forEach((p, i) => {
      const el = document.getElementById(`sanitize-ocr-page-${p.pageIndex}`)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          ratios.set(i, entry.intersectionRatio)
          let best = 0, bestRatio = -1
          ratios.forEach((r, idx) => { if (r > bestRatio) { bestRatio = r; best = idx } })
          onPageChange(best)
        },
        { threshold: thresholds },
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach((o) => o.disconnect())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length])

  return (
    <div className="relative flex flex-col gap-4 p-4">
      {pages.map((p, pi) => {
        const aspectRatio = p.widthPt > 0 ? `${p.widthPt} / ${p.heightPt}` : '1 / 1.414'
        const autoNoise = autoNoisePerPage[pi]
        const overrides = noiseOverrides.get(p.pageIndex) ?? new Set<number>()
        const finalNoise = applyNoiseOverrides(autoNoise, overrides)

        // Filter out text blocks overlapping images, preserving original indices for noise key stability.
        const filteredWithIndex = p.textBlocks
          .map((b, i) => ({ b, i }))
          .filter(({ b }) => !overlapsImage(b, p.imageBlocks, imageYOffset))

        return (
          <div key={p.pageIndex} id={`sanitize-ocr-page-${p.pageIndex}`}>
            <div className="w-full bg-white relative" style={{ aspectRatio }}>
              {p.imageBlocks.map((img, i) => (
                <PageImage key={i} img={img} imageYOffset={imageYOffset} />
              ))}

              {filteredWithIndex.map(({ b, i: bi }) => {
                const isNoise = finalNoise.has(bi)
                return (
                  <span
                    key={bi}
                    style={{
                      position: 'absolute',
                      left: `${b.x * 100}%`,
                      top: `${b.y * 100}%`,
                      fontSize: `${b.height * p.heightPt * TEXT_SCALE}px`,
                      lineHeight: 1.15,
                      whiteSpace: 'nowrap',
                      color: isNoise ? 'rgba(180,120,0,0.7)' : '#111',
                      fontFamily: 'var(--font-geist-sans), sans-serif',
                      backgroundColor: isNoise ? 'rgba(245,158,11,0.18)' : 'transparent',
                      outline: isNoise ? '1px dashed rgba(245,158,11,0.5)' : 'none',
                      cursor: 'default',
                      userSelect: 'none',
                    }}
                    onClick={(e) => {
                      if (e.shiftKey) onToggleNoise(p.pageIndex, bi)
                    }}
                  >
                    {b.text}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
