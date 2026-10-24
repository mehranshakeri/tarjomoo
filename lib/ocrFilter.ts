import type { TextBlock, ImageBlock } from './types'

export function overlapsImage(b: TextBlock, images: ImageBlock[], imageYOffset: number): boolean {
  const bCenterY = b.y + b.height / 2
  for (const img of images) {
    const imgTop = img.y + imageYOffset
    const imgBottom = imgTop + img.height
    if (
      b.x < img.x + img.width &&
      b.x + b.width > img.x &&
      bCenterY > imgTop &&
      bCenterY < imgBottom
    ) return true
  }
  return false
}

export function filterOcrBlocks(
  blocks: TextBlock[],
  images: ImageBlock[],
  imageYOffset: number,
): TextBlock[] {
  if (images.length === 0) return blocks
  return blocks.filter((b) => !overlapsImage(b, images, imageYOffset))
}
