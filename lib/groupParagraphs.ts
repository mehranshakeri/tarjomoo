import type { TextBlock, Paragraph } from './types'

// Paragraph detection: gap-relative threshold + indentation signals.
//
// Gap is compared to the running median of gaps already seen inside the current
// paragraph — more reliable than line height, which is the same for caption→body
// as it is for line→line within a paragraph.

const GAP_FACTOR = 1.6           // gap > this × median intra-para gap → new paragraph
const GAP_FIRST_FACTOR = 1.1     // fallback for first join (no gap history yet, use line height)
const INDENT_BREAK = 0.04        // rightward x shift signaling an indented paragraph start
const DEDENT_BREAK = 0.03        // leftward x shift signaling body text after a caption/heading
const INDENT_BREAK_SINGLE = 0.01 // tighter threshold when current para is only one line
const SHORT_LINE_RATIO = 0.72    // prev line width / para avg width below this → ragged end

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

export function groupParagraphs(blocks: TextBlock[]): Paragraph[] {
  if (blocks.length === 0) return []

  const sorted = blocks
    .map((b, i) => ({ b, i }))
    .sort((a, b) => a.b.y - b.b.y || a.b.x - b.b.x)

  const paragraphs: Paragraph[] = []
  let current: { b: TextBlock; i: number }[] = [sorted[0]]
  let intraGaps: number[] = []   // gaps between consecutive lines within current paragraph

  function flush() {
    const indices = current.map((c) => c.i)
    const y = current[0].b.y
    const text = current.map((c) => c.b.text).join(' ')
    paragraphs.push({ blockIndices: indices, y, text })
    current = []
    intraGaps = []
  }

  for (let k = 1; k < sorted.length; k++) {
    const prev = current[current.length - 1]
    const curr = sorted[k]

    const gap = curr.b.y - (prev.b.y + prev.b.height)
    const marginX = median(current.map((c) => c.b.x))
    const avgWidth = current.reduce((s, c) => s + c.b.width, 0) / current.length
    const drift = curr.b.x - marginX
    const indentThreshold = current.length === 1 ? INDENT_BREAK_SINGLE : INDENT_BREAK

    // Rightward shift → indented first line of new paragraph
    // Leftward shift → body text starting left of a caption/heading margin
    const incomingIndent = drift > indentThreshold || drift < -DEDENT_BREAK
    const outgoingRagged = prev.b.width < avgWidth * SHORT_LINE_RATIO

    let gapBreak: boolean
    if (intraGaps.length === 0) {
      const avgH = (prev.b.height + curr.b.height) / 2
      gapBreak = gap > avgH * GAP_FIRST_FACTOR
    } else {
      gapBreak = gap > median(intraGaps) * GAP_FACTOR
    }

    if (gapBreak) {
      flush()
      current = [curr]
      continue
    }

    if (incomingIndent || outgoingRagged) {
      flush()
      current = [curr]
    } else {
      intraGaps.push(gap)
      current.push(curr)
    }
  }
  flush()

  return paragraphs
}

export function paragraphKey(pageIndex: number, blockIndices: number[]): string {
  return `${pageIndex}-${blockIndices[0]}`
}
