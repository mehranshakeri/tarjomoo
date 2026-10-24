import type { OcrExport, OcrPageData, TranslatedParagraph, ParagraphMerge } from './types'

export function downloadOcrJson(data: OcrExport): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = data.fileName.replace(/\.pdf$/i, '') + '.ocr.json'
  a.click()
  URL.revokeObjectURL(url)
}

export function parseOcrJson(text: string): OcrExport | null {
  try {
    const parsed = JSON.parse(text)
    if (parsed?.version !== 1 || !Array.isArray(parsed.pages)) return null
    return parsed as OcrExport
  } catch {
    return null
  }
}

export function buildOcrExport(
  fileName: string,
  imageYLines: number,
  pageDataMap: Map<number, OcrPageData>,
  totalPages: number,
  translations?: Map<string, TranslatedParagraph>,
  merges?: ParagraphMerge[],
): OcrExport {
  const pages: OcrPageData[] = []
  for (let i = 0; i < totalPages; i++) {
    const data = pageDataMap.get(i)
    if (data) pages.push(data)
  }
  const result: OcrExport = { version: 1, fileName, imageYLines, pages }
  if (translations && translations.size > 0) {
    result.translations = Array.from(translations.values())
  }
  if (merges && merges.length > 0) {
    result.merges = merges
  }
  return result
}
