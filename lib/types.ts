export interface TextBlock {
  text: string
  x: number      // 0–1 fraction of page width
  y: number      // 0–1 fraction of page height
  width: number  // 0–1
  height: number // 0–1
}

export interface ImageBlock {
  dataUrl: string
  x: number      // 0–1 fraction of page width
  y: number      // 0–1 fraction of page height
  width: number  // 0–1
  height: number // 0–1
}

export type PageStatus = 'pending' | 'processing' | 'done' | 'error'

export interface OcrPageData {
  pageIndex: number
  widthPt: number
  heightPt: number
  textBlocks: TextBlock[]
  imageBlocks: ImageBlock[]
}

export interface Paragraph {
  blockIndices: number[]  // indices into OcrPageData.textBlocks, sorted by y
  y: number               // top of first line (normalized 0–1)
  text: string            // joined text of all lines
}

export interface TranslatedParagraph {
  pageIndex: number
  paragraphKey: string    // `${pageIndex}-${blockIndices[0]}`
  y: number               // same y as source paragraph
  text: string            // translated text
  sourceKeys?: string[]   // all keys sent together (for group selection sync)
}

export interface OcrExport {
  version: 1
  fileName: string
  imageYLines: number
  pages: OcrPageData[]
  translations?: TranslatedParagraph[]
  merges?: ParagraphMerge[]
}

// Records a merge operation: two paragraph keys collapsed into survivingKey
export interface ParagraphMerge {
  survivingKey: string   // key kept (first block, by document order)
  removedKey: string     // key deleted and absorbed into survivingKey
  mergedText: string     // combined text at time of merge
}

export interface SanitizedBlock {
  kind: 'paragraph' | 'image'
  paragraphKey?: string  // kind === 'paragraph' — matches TranslatedParagraph.paragraphKey
  text?: string          // kind === 'paragraph'
  dataUrl?: string       // kind === 'image'
  aspectRatio?: number   // kind === 'image' — width/height, reserves layout space before decode
  y: number              // normalized 0–1, used for sorting only
}

export interface SanitizedPage {
  pageIndex: number
  blocks: SanitizedBlock[]
}
