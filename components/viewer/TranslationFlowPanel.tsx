import type { OcrPageData, SanitizedPage, TranslatedParagraph } from '@/lib/types'
import { TranslationEditor } from './TranslationEditor'
import { SanitizedImageBlock } from './SanitizedImageBlock'

interface Props {
  sanitizedPages: Map<number, SanitizedPage>
  pages: OcrPageData[]
  translations: Map<string, TranslatedParagraph>
  translating: Set<string>
  translationErrors: Map<string, string>
  selectedKeys: Set<string>
  dir: 'rtl' | 'ltr'
  onSelect: (key: string) => void
  onEdit: (key: string, text: string) => void
}

export function TranslationFlowPanel({
  sanitizedPages,
  pages,
  translations,
  translating,
  translationErrors,
  selectedKeys,
  dir,
  onSelect,
  onEdit,
}: Props) {
  return (
    <div className="flex flex-col gap-0 p-4">
      {pages.map((p) => {
        const sanitizedPage = sanitizedPages.get(p.pageIndex)
        const blocks = sanitizedPage?.blocks ?? []
        const hasContent = blocks.some(
          (b) => b.kind === 'image' || translations.has(b.paragraphKey ?? '')
        )

        return (
          <div key={p.pageIndex} id={`tr-page-${p.pageIndex}`} className="border-b border-foreground/5 pb-4 mb-4">
            {blocks.map((block, i) => {
              if (block.kind === 'image') {
                return <SanitizedImageBlock key={i} dataUrl={block.dataUrl} aspectRatio={block.aspectRatio} />
              }

              const key = block.paragraphKey!
              const translation = translations.get(key)
              const isStreaming = translating.has(key)
              const hasTranslation = !!translation || isStreaming

              if (!hasTranslation) {
                return (
                  <div
                    key={key}
                    className="px-3 py-2 text-xs text-foreground/20 italic"
                    dir={dir}
                  >
                    —
                  </div>
                )
              }

              return (
                <TranslationEditor
                  key={key}
                  paragraphKey={key}
                  initialText={translation?.text ?? ''}
                  isStreaming={isStreaming}
                  isSelected={selectedKeys.has(key)}
                  error={translationErrors.get(key) ?? null}
                  dir={dir}
                  onChange={onEdit}
                  onClick={onSelect}
                />
              )
            })}

            {!hasContent && (
              <div className="flex items-center justify-center py-12 text-xs text-foreground/20">
                Click a paragraph on the left to translate
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
