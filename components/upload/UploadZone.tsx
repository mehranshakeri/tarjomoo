import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
}

const pillClass = [
  'inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-1.5',
  'text-sm text-foreground/60 transition-colors outline-none',
  'hover:text-foreground hover:border-foreground/40 hover:bg-foreground/[0.03]',
  'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground/30',
].join(' ')

function isAccepted(file: File) {
  return file.type === 'application/pdf' || file.name.endsWith('.ocr.json') || file.name.endsWith('.json')
}

export function UploadZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFile(file: File) {
    if (isAccepted(file)) onFile(file)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-semibold text-foreground mb-2 text-center">
          Start with uploading your PDF
        </h1>
        <p className="text-center text-sm text-foreground/60 mb-8">
          Upload a PDF to view it alongside extracted text.
        </p>

        <div
          role="button"
          tabIndex={0}
          aria-label="Upload PDF or OCR JSON"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          className={[
            'border-2 border-dashed rounded-2xl p-16 flex flex-col items-center gap-4',
            'cursor-pointer transition-colors select-none outline-none',
            'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground/30',
            dragging
              ? 'border-foreground/60 bg-foreground/5'
              : 'border-foreground/20 hover:border-foreground/40 hover:bg-foreground/[0.02]',
          ].join(' ')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-12 h-12 text-foreground/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
            />
          </svg>

          <div className="text-center">
            <p className="font-medium text-foreground">
              {dragging ? 'Drop your PDF here' : 'Drag & drop your file here'}
            </p>
            <p className="text-sm text-foreground/50 mt-1">or click to browse</p>
          </div>

          <span className="text-xs text-foreground/30 uppercase tracking-wider">PDF</span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />

        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="https://github.com/mehranshakeri/tarjomoo"
            target="_blank"
            rel="noopener noreferrer"
            className={pillClass}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
            Source
          </a>
          <a
            href="mailto:contact@tarjomoo.com?subject=Tarjomoo%20feedback"
            title="Send us a message"
            className={pillClass}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
            Feedback
          </a>
        </div>
      </div>
    </div>
  )
}
