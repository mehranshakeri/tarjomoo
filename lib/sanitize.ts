import type { OcrPageData, TextBlock, SanitizedBlock, SanitizedPage } from './types'
import { filterOcrBlocks } from './ocrFilter'
import { groupParagraphs, paragraphKey } from './groupParagraphs'

export interface SanitizeOptions {
  noiseThresholdTop: number     // fraction from top (0–1)
  noiseThresholdBottom: number  // fraction from bottom (0–1)
}

export const DEFAULT_SANITIZE_OPTIONS: SanitizeOptions = { noiseThresholdTop: 0.12, noiseThresholdBottom: 0.04 }

// Returns indices into `blocks` that fall in the top/bottom noise band.
export function detectNoise(blocks: TextBlock[], options: SanitizeOptions = DEFAULT_SANITIZE_OPTIONS): Set<number> {
  const noisy = new Set<number>()
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.y < options.noiseThresholdTop || b.y > 1 - options.noiseThresholdBottom) noisy.add(i)
  }
  return noisy
}

// Symmetric difference: each index in `overrides` flips its auto-detected status.
export function applyNoiseOverrides(autoNoise: Set<number>, overrides: Set<number>): Set<number> {
  const result = new Set(autoNoise)
  for (const idx of overrides) {
    if (result.has(idx)) result.delete(idx)
    else result.add(idx)
  }
  return result
}

// Full sanitization pipeline for a single page.
// noiseOverrides: set of raw textBlock indices (into page.textBlocks) that the user toggled.
// imageYOffset: same offset used in the OCR viewer — must match so overlap detection is consistent.
export function sanitizePage(
  page: OcrPageData,
  noiseOverrides: Set<number>,
  imageYOffset: number,
  options: SanitizeOptions = DEFAULT_SANITIZE_OPTIONS,
): SanitizedPage {
  const autoNoise = detectNoise(page.textBlocks, options)
  const finalNoise = applyNoiseOverrides(autoNoise, noiseOverrides)

  const withOriginalIndex = page.textBlocks
    .map((b, i) => ({ b, origIdx: i }))
    .filter(({ origIdx }) => !finalNoise.has(origIdx))

  const blocksOnly = withOriginalIndex.map(({ b }) => b)
  const filtered = filterOcrBlocks(blocksOnly, page.imageBlocks, imageYOffset)

  const paragraphs = groupParagraphs(filtered)

  const blocks: SanitizedBlock[] = [
    ...paragraphs.map((p): SanitizedBlock => ({
      kind: 'paragraph',
      paragraphKey: paragraphKey(page.pageIndex, p.blockIndices),
      text: p.text,
      y: p.y,
    })),
    ...page.imageBlocks.map((img): SanitizedBlock => ({
      kind: 'image',
      dataUrl: img.dataUrl,
      aspectRatio: img.height > 0 ? img.width / img.height : undefined,
      y: img.y + imageYOffset,
    })),
  ]
  blocks.sort((a, b) => a.y - b.y)

  return { pageIndex: page.pageIndex, blocks }
}
