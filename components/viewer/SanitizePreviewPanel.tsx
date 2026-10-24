'use client'

import { useRef } from 'react'
import type { SanitizedPage } from '@/lib/types'
import { SanitizedImageBlock } from './SanitizedImageBlock'

const DOUBLE_CLICK_MS = 300

function ParagraphGap() {
  return <div className="h-3" aria-hidden="true" />
}

interface Props {
  sanitizedPage: SanitizedPage | undefined
  pageIndex: number
  selectedKeys?: Set<string>
  onSelect?: (key: string, multi: boolean) => void
  onTranslate?: (keys: string[]) => void
  onSelectWithPosition?: (key: string, multi: boolean, x: number, y: number) => void
}

export function SanitizePreviewPanel({
  sanitizedPage,
  pageIndex,
  selectedKeys,
  onSelect,
  onTranslate,
  onSelectWithPosition,
}: Props) {
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingKeyRef = useRef<string | null>(null)
  if (!sanitizedPage) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-foreground/40">
        <span>Processing page {pageIndex + 1}…</span>
      </div>
    )
  }

  if (sanitizedPage.blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-foreground/40">
        <span>No content after sanitization</span>
      </div>
    )
  }

  return (
    <div className="p-6 font-sans">
      {sanitizedPage.blocks.map((block, i) => {
        if (block.kind === 'image') {
          return <SanitizedImageBlock key={i} dataUrl={block.dataUrl} aspectRatio={block.aspectRatio} />
        }

        const key = block.paragraphKey
        const isSelected = !!key && !!selectedKeys?.has(key)
        const isLast = i === sanitizedPage.blocks.length - 1
        const nextIsImage = !isLast && sanitizedPage.blocks[i + 1].kind === 'image'

        const handleClick = (e: React.MouseEvent) => {
          if (!key) return
          if (clickTimerRef.current && pendingKeyRef.current === key) {
            clearTimeout(clickTimerRef.current)
            clickTimerRef.current = null
            pendingKeyRef.current = null
            const keys = selectedKeys && selectedKeys.size > 1 && selectedKeys.has(key)
              ? Array.from(selectedKeys)
              : [key]
            onTranslate?.(keys)
            return
          }
          const shiftKey = e.shiftKey
          const clientX = e.clientX
          const clientY = e.clientY
          pendingKeyRef.current = key
          clickTimerRef.current = setTimeout(() => {
            clickTimerRef.current = null
            pendingKeyRef.current = null
            if (onSelectWithPosition) {
              onSelectWithPosition(key, shiftKey, clientX, clientY)
            } else {
              onSelect?.(key, shiftKey)
            }
          }, DOUBLE_CLICK_MS)
        }

        return (
          <div key={i}>
            <p
              className={`text-sm leading-relaxed transition-colors rounded px-1 -mx-1 ${
                key ? 'cursor-pointer select-none' : ''
              } ${
                isSelected
                  ? 'border-l-2 border-blue-400 bg-blue-50/60 pl-2'
                  : key
                    ? 'border-l-2 border-transparent hover:border-amber-300 pl-2'
                    : ''
              } text-foreground`}
              onClick={handleClick}
            >
              {block.text}
            </p>
            {!isLast && !nextIsImage && <ParagraphGap />}
          </div>
        )
      })}
    </div>
  )
}
