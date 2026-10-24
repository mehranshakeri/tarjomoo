import type { TextBlock } from './types'

const ABSOLUTE_MAX = 20
let userMax = 10

interface PoolSlot {
  worker: import('tesseract.js').Worker
  busy: boolean
}

let pool: PoolSlot[] = []
let targetSize = 0
let growing = false
let firstPageDone = false
let lastPageCount = 0

const waitQueue: Array<(slot: PoolSlot) => void> = []

async function makeWorker(): Promise<PoolSlot> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  return { worker, busy: false }
}

function growPool(): void {
  if (growing || pool.length >= targetSize) return
  growing = true
  async function step() {
    while (pool.length < targetSize) {
      try {
        const slot = await makeWorker()
        pool.push(slot)
        if (waitQueue.length > 0) {
          slot.busy = true
          waitQueue.shift()!(slot)
        }
      } catch {
        break
      }
    }
    growing = false
  }
  step()
}

async function ensureAtLeastOne(pageCount: number): Promise<void> {
  lastPageCount = pageCount
  targetSize = Math.max(1, Math.min(userMax, Math.floor(pageCount / 2)))
  if (pool.length === 0) {
    const slot = await makeWorker()
    pool.push(slot)
  }
}

function acquireSlot(): Promise<PoolSlot> {
  const free = pool.find((s) => !s.busy)
  if (free) {
    free.busy = true
    return Promise.resolve(free)
  }
  return new Promise((resolve) => waitQueue.push(resolve))
}

function releaseSlot(slot: PoolSlot): void {
  if (waitQueue.length > 0) {
    waitQueue.shift()!(slot)
  } else {
    slot.busy = false
  }
  if (!firstPageDone) {
    firstPageDone = true
    growPool()
  }
}

export function getPoolSize(): number {
  return pool.length
}

export function setWorkerMax(n: number): void {
  userMax = Math.max(1, Math.min(ABSOLUTE_MAX, n))
  // Recompute targetSize based on the new userMax (pageCount is baked into the last ensureAtLeastOne call)
  if (lastPageCount > 0) {
    targetSize = Math.max(1, Math.min(userMax, Math.floor(lastPageCount / 2)))
  }
  if (firstPageDone && pool.length < targetSize) growPool()
}

export function getWorkerMax(): number {
  return userMax
}

export async function terminateWorker(): Promise<void> {
  const current = pool
  pool = []
  targetSize = 0
  growing = false
  firstPageDone = false
  lastPageCount = 0
  waitQueue.length = 0
  await Promise.all(current.map((s) => s.worker.terminate()))
}

export async function recognizePage(canvas: HTMLCanvasElement, pageCount: number): Promise<TextBlock[]> {
  await ensureAtLeastOne(pageCount)

  const slot = await acquireSlot()
  try {
    const result = await slot.worker.recognize(canvas, {}, { blocks: true })
    const { width, height } = canvas

    const blocks = result.data.blocks ?? []
    const lines = blocks.flatMap((b) =>
      (b.paragraphs ?? []).flatMap((p) => p.lines ?? [])
    )

    return lines
      .filter((l) => l.text.trim().length > 0 && l.confidence > 10)
      .map((l) => ({
        text: l.text.trimEnd(),
        x: l.bbox.x0 / width,
        y: l.bbox.y0 / height,
        width: (l.bbox.x1 - l.bbox.x0) / width,
        height: (l.bbox.y1 - l.bbox.y0) / height,
      } satisfies TextBlock))
  } finally {
    releaseSlot(slot)
  }
}
