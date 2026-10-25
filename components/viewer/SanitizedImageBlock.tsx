interface Props {
  dataUrl?: string
  aspectRatio?: number
}

export function SanitizedImageBlock({ dataUrl, aspectRatio }: Props) {
  if (!dataUrl) return null
  return (
    <div className="flex justify-center my-2">
      <div style={{ width: '70%', aspectRatio }}>
        <img src={dataUrl} alt="" style={{ width: '100%', height: '100%', maxHeight: '40vh', objectFit: 'contain', display: 'block' }} />
      </div>
    </div>
  )
}
