'use client'

import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
}

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
          PDF Viewer & OCR
        </h1>
        <p className="text-center text-sm text-foreground/60 mb-8">
          Upload a PDF to view it alongside extracted text — or drop a saved OCR JSON to restore a session.
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
              {dragging ? 'Drop your file here' : 'Drag & drop your file here'}
            </p>
            <p className="text-sm text-foreground/50 mt-1">or click to browse</p>
          </div>

          <span className="text-xs text-foreground/30 uppercase tracking-wider">PDF or OCR JSON</span>
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
      </div>
    </div>
  )
}
