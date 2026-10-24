import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
} from 'docx'
import type { OcrExport, SanitizedPage, TranslatedParagraph } from './types'

const MAX_IMG_WIDTH_PX = 600

function getImageNaturalSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 1, height: 1 })
    img.src = dataUrl
  })
}

async function dataUrlToImageRun(dataUrl: string): Promise<ImageRun | null> {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|bmp|webp);base64,(.+)$/)
  if (!match) return null
  const rawType = match[1]
  const base64 = match[2]
  const normalized = rawType === 'jpeg' ? 'jpg' : rawType
  if (!['png', 'jpg', 'gif', 'bmp'].includes(normalized)) return null
  const type = normalized as 'png' | 'jpg' | 'gif' | 'bmp'
  const { width: nw, height: nh } = await getImageNaturalSize(dataUrl)
  const width = Math.min(nw, MAX_IMG_WIDTH_PX)
  const height = nw > 0 ? Math.round(width * nh / nw) : nh
  return new ImageRun({ data: base64, type, transformation: { width, height } })
}

export async function downloadDocx(
  ocrData: OcrExport,
  sanitizedPages: Map<number, SanitizedPage>,
  translations: Map<string, TranslatedParagraph>,
  dir: 'rtl' | 'ltr',
): Promise<void> {
  const isRtl = dir === 'rtl'
  const font = isRtl ? 'Noto Sans Arabic' : 'Calibri'
  const alignment = isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT

  const paragraphs: Paragraph[] = []

  for (const [pageIdx, page] of ocrData.pages.entries()) {
    const sanitizedPage = sanitizedPages.get(page.pageIndex)
    if (!sanitizedPage) continue

    for (const [blockIndex, block] of sanitizedPage.blocks.entries()) {
      const isFirstBlockOfPage = blockIndex === 0
      const pageBreakBefore = isFirstBlockOfPage && pageIdx > 0

      if (block.kind === 'image') {
        if (!block.dataUrl) continue
        const imageRun = await dataUrlToImageRun(block.dataUrl)
        if (!imageRun) continue
        paragraphs.push(
          new Paragraph({
            pageBreakBefore,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [imageRun],
          }),
        )
        continue
      }

      if (block.kind === 'paragraph' && block.paragraphKey) {
        const text = translations.get(block.paragraphKey)?.text ?? block.text ?? ''
        paragraphs.push(
          new Paragraph({
            pageBreakBefore,
            bidirectional: isRtl,
            alignment,
            spacing: { after: 120 },
            children: [
              new TextRun({ text, font, size: 24 }),
            ],
          }),
        )
      }
    }
  }

  const baseName = ocrData.fileName.replace(/\.pdf$/i, '')
  const doc = new Document({
    creator: 'tarjomoo',
    title: baseName,
    sections: [{ children: paragraphs }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = baseName + '.docx'
  a.click()
  URL.revokeObjectURL(url)
}
