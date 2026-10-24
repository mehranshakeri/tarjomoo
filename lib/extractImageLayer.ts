import type { PDFPageProxy } from 'pdfjs-dist'
import { OPS } from 'pdfjs-dist'
import type { ImageBlock } from './types'

type Matrix = [number, number, number, number, number, number]

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

interface PdfjsImage {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array | null
  bitmap: VideoFrame | ImageBitmap | null
  kind?: number
}

interface Bounds {
  x: number; y: number; width: number; height: number
}

function imageToDataUrl(imgData: PdfjsImage): string | null {
  const scratch = document.createElement('canvas')
  scratch.width = imgData.width
  scratch.height = imgData.height
  const ctx = scratch.getContext('2d')!

  if (imgData.bitmap) {
    ctx.drawImage(imgData.bitmap as CanvasImageSource, 0, 0)
  } else if (imgData.data) {
    const src = imgData.data
    const imageData = ctx.createImageData(imgData.width, imgData.height)
    const dst = imageData.data
    if (src.length === imgData.width * imgData.height * 3) {
      for (let p = 0, q = 0; p < src.length; p += 3, q += 4) {
        dst[q] = src[p]; dst[q + 1] = src[p + 1]; dst[q + 2] = src[p + 2]; dst[q + 3] = 255
      }
    } else {
      dst.set(src.slice(0, dst.length))
    }
    ctx.putImageData(imageData, 0, 0)
  } else {
    return null
  }

  return scratch.toDataURL()
}

function ctmToBlock(
  ctm: Matrix,
  vt: number[],  // viewport.transform: maps PDF user space → screen space
  viewportWidth: number,
  viewportHeight: number,
): Bounds | null {
  const [a, b, c, d, e, f] = ctm
  // Four corners of the unit square in PDF image space, mapped through CTM to PDF user space
  const pdfCorners: [number, number][] = [
    [e,         f        ],
    [a + e,     b + f    ],
    [c + e,     d + f    ],
    [a + c + e, b + d + f],
  ]
  // Apply viewport transform [vt0, vt1, vt2, vt3, vt4, vt5] to get screen coords:
  // x' = vt[0]*x + vt[2]*y + vt[4]
  // y' = vt[1]*x + vt[3]*y + vt[5]
  const screenCorners = pdfCorners.map(([x, y]): [number, number] => [
    vt[0] * x + vt[2] * y + vt[4],
    vt[1] * x + vt[3] * y + vt[5],
  ])
  const xs = screenCorners.map(([x]) => x)
  const ys = screenCorners.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const x = minX / viewportWidth
  const w = (maxX - minX) / viewportWidth
  const y = minY / viewportHeight
  const h = (maxY - minY) / viewportHeight

  if (w < 0.02 || h < 0.02) return null

  const visibleW = Math.min(1, x + w) - Math.max(0, x)
  const visibleH = Math.min(1, y + h) - Math.max(0, y)
  if (visibleW <= 0 || visibleH <= 0) return null
  if (visibleW / w < 0.6 || visibleH / h < 0.6) return null

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.min(1, w),
    height: Math.min(1, h),
  }
}

export async function extractImageLayer(
  page: PDFPageProxy,
): Promise<ImageBlock[]> {
  const viewport = page.getViewport({ scale: 1 })
  const { width: viewportWidth, height: viewportHeight, transform: vt } = viewport

  // Render at minimal scale to guarantee page.objs delivery for named image XObjects.
  // Retry if cancelled by a concurrent render (pdfjs allows only one render per page).
  const tinyViewport = page.getViewport({ scale: 0.1 })
  const scratch = document.createElement('canvas')
  scratch.width = Math.ceil(tinyViewport.width)
  scratch.height = Math.ceil(tinyViewport.height)
  const ctx = scratch.getContext('2d')!
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await page.render({ canvas: scratch, canvasContext: ctx, viewport: tinyViewport }).promise
      break
    } catch {
      // Render was cancelled by a concurrent render — wait briefly and retry
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
    }
  }

  const opList = await page.getOperatorList()
  const { fnArray, argsArray } = opList

  const results: ImageBlock[] = []
  const ctmStack: Matrix[] = []
  let ctm: Matrix = IDENTITY

  const pending: Array<{ name: string; bounds: Bounds }> = []

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]
    const args = argsArray[i] as unknown[]

    if (fn === OPS.save) {
      ctmStack.push(ctm)
    } else if (fn === OPS.restore) {
      ctm = ctmStack.pop() ?? IDENTITY
    } else if (fn === OPS.transform) {
      ctm = multiply(ctm, args as Matrix)
    } else if (fn === OPS.paintInlineImageXObject) {
      const imgData = args[0] as PdfjsImage
      if (!imgData?.width || !imgData?.height) continue
      const bounds = ctmToBlock(ctm, vt, viewportWidth, viewportHeight)
      if (!bounds) continue
      const dataUrl = imageToDataUrl(imgData)
      if (dataUrl) results.push({ dataUrl, ...bounds })
    } else if (fn === OPS.paintImageXObject) {
      const objName = args[0] as string
      if (!objName) continue
      const bounds = ctmToBlock(ctm, vt, viewportWidth, viewportHeight)
      if (!bounds) continue
      pending.push({ name: objName, bounds })
    }
  }

  // Timeout per image object — if page.objs.get callback never fires (render was
  // cancelled and objects were never delivered), resolve after 5s rather than hanging.
  const OBJ_TIMEOUT_MS = 5_000
  await Promise.all(
    pending.map(({ name, bounds }) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, OBJ_TIMEOUT_MS)
        page.objs.get(name, (imgData: PdfjsImage) => {
          clearTimeout(timer)
          if (imgData?.width && imgData?.height) {
            const dataUrl = imageToDataUrl(imgData)
            if (dataUrl) results.push({ dataUrl, ...bounds })
          }
          resolve()
        })
      })
    )
  )

  return results
}
