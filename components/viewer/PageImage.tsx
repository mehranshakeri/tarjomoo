import type { ImageBlock } from '@/lib/types'

interface Props {
  img: ImageBlock
  imageYOffset: number
}

// eslint-disable-next-line @next/next/no-img-element
export function PageImage({ img, imageYOffset }: Props) {
  return (
    <img
      src={img.dataUrl}
      alt=""
      style={{
        position: 'absolute',
        left: `${img.x * 100}%`,
        top: `${(img.y + imageYOffset) * 100}%`,
        width: `${img.width * 100}%`,
        height: `${img.height * 100}%`,
        objectFit: 'fill',
      }}
    />
  )
}
