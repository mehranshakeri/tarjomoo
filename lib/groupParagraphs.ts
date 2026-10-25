import type { TextBlock, Paragraph } from './types'

// Paragraph detection: gap-relative threshold + indentation signals + line-fit check.
//
// Gap is compared to the running median of gaps already seen inside the current
// paragraph — more reliable than line height, which is the same for caption→body
// as it is for line→line within a paragraph.
//
// Lines that end with room to spare for the next word were broken on purpose
// (see endedEarly); on contents/index pages, a page number ends an entry.

const GAP_FACTOR = 1.6           // gap > this × median intra-para gap → new paragraph
const GAP_FIRST_FACTOR = 1.1     // fallback for first join (no gap history yet, use line height)
const INDENT_BREAK = 0.04        // rightward x shift signaling an indented paragraph start
const DEDENT_BREAK = 0.03        // leftward x shift signaling body text after a caption/heading
const INDENT_BREAK_SINGLE = 0.01 // tighter threshold when current para is only one line
const SHORT_LINE_RATIO = 0.72    // prev line width / para avg width below this → ragged end
const EDGE_WINDOW = 3            // lines above/below used to find the local right edge of the text
const BLOCK_GAP_FACTOR = 1.6     // gap > this × typical line gap separates text blocks for that edge
const FIT_TOLERANCE = 0.02       // extra room (page-width fraction) required before calling a line "ended early"
const LIST_PAGE_RATIO = 0.5      // share of lines ending in a page number that marks a contents/index page

// Line ends in a page locator: "… 152", "… ix"
const ENDS_WITH_LOCATOR = /(^|\s)(\d{1,4}|[ivxlcdm]{1,7})$/i
const STARTS_ENTRY = /^[\p{Lu}\d]/u
const ENDS_WITH_HYPHEN = /[-‐]$/

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

// Right edge of the text around each line: the widest line within EDGE_WINDOW lines,
// not crossing a vertical gap. Keeps narrow blocks (quotes, epigraphs) measured against
// their own width while short lines inside body text see the full column.
function localRightEdges(lines: TextBlock[]): number[] {
  const gaps = lines.slice(1).map((b, k) => b.y - (lines[k].y + lines[k].height))
  const typicalGap = median(gaps.filter((g) => g > 0))
  const blockGap = typicalGap > 0 ? typicalGap * BLOCK_GAP_FACTOR : Infinity
  const blockId = [0]
  for (let k = 1; k < lines.length; k++) blockId.push(blockId[k - 1] + (gaps[k - 1] > blockGap ? 1 : 0))

  return lines.map((_, k) => {
    let edge = 0
    for (let j = Math.max(0, k - EDGE_WINDOW); j <= Math.min(lines.length - 1, k + EDGE_WINDOW); j++) {
      if (blockId[j] === blockId[k]) edge = Math.max(edge, lines[j].x + lines[j].width)
    }
    return edge
  })
}

// A line only wraps when the next word doesn't fit. If `prev` ends with enough room
// left for the first word of `curr`, the line break was intentional (list entry,
// last line of a paragraph, heading…).
function endedEarly(prev: TextBlock, curr: TextBlock, columnRight: number): boolean {
  const prevText = prev.text.trim()
  const currText = curr.text.trim()
  if (ENDS_WITH_HYPHEN.test(prevText) || currText.length === 0) return false
  const firstWord = currText.split(/\s+/)[0]
  const charWidth = curr.width / currText.length
  const room = columnRight - (prev.x + prev.width)
  return room > (firstWord.length + 1) * charWidth + FIT_TOLERANCE
}

export function groupParagraphs(blocks: TextBlock[]): Paragraph[] {
  if (blocks.length === 0) return []

  const sorted = blocks
    .map((b, i) => ({ b, i }))
    .sort((a, b) => a.b.y - b.b.y || a.b.x - b.b.x)

  const rightEdges = localRightEdges(sorted.map((s) => s.b))
  const locatorLines = blocks.filter((b) => ENDS_WITH_LOCATOR.test(b.text.trim())).length
  const isListPage = blocks.length >= 3 && locatorLines / blocks.length >= LIST_PAGE_RATIO

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

    // Leftward shift after a single line is usually an indented first line wrapping to
    // the body margin — unless that line was itself the indented continuation of a
    // wrapped line (hanging indent, e.g. bibliography entries).
    const beforePrev = k >= 2 ? sorted[k - 2].b : null
    const prevIsHangingContinuation =
      !!beforePrev && beforePrev.x < prev.b.x && !endedEarly(beforePrev, prev.b, rightEdges[k - 2])

    // Rightward shift → indented first line of new paragraph
    // Leftward shift → body text starting left of a caption/heading margin or hanging indent
    const dedent = drift < -DEDENT_BREAK && (current.length > 1 || prevIsHangingContinuation)
    const incomingIndent = drift > indentThreshold || dedent
    const outgoingRagged =
      prev.b.width < avgWidth * SHORT_LINE_RATIO ||
      endedEarly(prev.b, curr.b, rightEdges[k - 1]) ||
      (isListPage && ENDS_WITH_LOCATOR.test(prev.b.text.trim()) && STARTS_ENTRY.test(curr.b.text.trim()))

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
