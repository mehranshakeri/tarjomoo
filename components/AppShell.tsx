import { useState } from 'react'
import { UploadZone } from '@/components/upload/UploadZone'
import { ViewerShell } from '@/components/viewer/ViewerShell'
import { TranslateShell } from '@/components/viewer/TranslateShell'
import { usePdfDocument } from '@/hooks/usePdfDocument'
import { PageLoadingSpinner } from '@/components/viewer/PageLoadingSpinner'
import { terminateWorker } from '@/lib/ocrEngine'
import { parseOcrJson } from '@/lib/ocrExport'
import { TranslationParamsModal } from '@/components/TranslationParamsModal'
import { useTranslationParams } from '@/hooks/useTranslationParams'
import { GeminiSettings } from '@/components/GeminiSettings'
import { useGeminiKey } from '@/hooks/useGeminiKey'
import { SanitizeShell } from '@/components/viewer/SanitizeShell'
import type { OcrExport, SanitizedPage } from '@/lib/types'
import type { TranslationParams } from '@/hooks/useTranslationParams'

type AppState =
  | { mode: 'idle' }
  | { mode: 'params'; file: File }
  | { mode: 'pdf'; file: File }
  | { mode: 'sanitize'; data: OcrExport; params: TranslationParams }
  | { mode: 'translate'; data: OcrExport; params: TranslationParams; sanitizedPages: Map<number, SanitizedPage> }
  | { mode: 'json-error'; message: string }

function AppContent() {
  const { params, setParams } = useTranslationParams()
  const [state, setState] = useState<AppState>({ mode: 'idle' })

  const pdfFile = state.mode === 'pdf' ? state.file : null
  const { pdfDoc, loading, error } = usePdfDocument(pdfFile)

  function handleReset() {
    terminateWorker()
    setState({ mode: 'idle' })
  }

  function handleFile(file: File) {
    if (file.type === 'application/pdf') {
      setState({ mode: 'params', file })
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text !== 'string') { setState({ mode: 'json-error', message: 'Could not read file' }); return }
      const data = parseOcrJson(text)
      if (!data) { setState({ mode: 'json-error', message: 'Not a valid OCR JSON file' }); return }
      setState({ mode: 'translate', data, params: { sourceLang: 'English', targetLang: 'Persian/Farsi', tones: ['Professional & Business'] }, sanitizedPages: new Map() })
    }
    reader.readAsText(file)
  }

  function handleAdvance(data: OcrExport, params: TranslationParams) {
    terminateWorker()
    setState({ mode: 'sanitize', data, params })
  }

  if (state.mode === 'idle') {
    return <UploadZone onFile={handleFile} />
  }

  if (state.mode === 'params') {
    return (
      <TranslationParamsModal
        params={params}
        onConfirm={(next) => { setParams(next); setState({ mode: 'pdf', file: state.file }) }}
        onClose={handleReset}
      />
    )
  }

  if (state.mode === 'json-error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-500">{state.message}</p>
        <button onClick={handleReset} className="text-sm underline text-foreground/60 hover:text-foreground">
          Try again
        </button>
      </div>
    )
  }

  if (state.mode === 'sanitize') {
    return (
      <SanitizeShell
        ocrData={state.data}
        onComplete={(sanitizedPages) =>
          setState({ mode: 'translate', data: state.data, params: state.params, sanitizedPages })
        }
      />
    )
  }

  if (state.mode === 'translate') {
    return <TranslateShell ocrData={state.data} params={state.params} sanitizedPages={state.sanitizedPages} onReset={handleReset} />
  }

  // PDF mode
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PageLoadingSpinner label="Loading PDF…" />
      </div>
    )
  }

  if (error || !pdfDoc) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-500">Failed to load PDF: {error}</p>
        <button onClick={handleReset} className="text-sm underline text-foreground/60 hover:text-foreground">
          Try again
        </button>
      </div>
    )
  }

  return (
    <ViewerShell
      pdfDoc={pdfDoc}
      fileName={state.file.name}
      onReset={handleReset}
      onAdvance={handleAdvance}
    />
  )
}

export function AppShell() {
  const { apiKey, setApiKey } = useGeminiKey()
  const [showSettings, setShowSettings] = useState(!apiKey)

  return (
    <>
      <AppContent />
      {showSettings && (
        <GeminiSettings
          apiKey={apiKey}
          onSave={(key) => { setApiKey(key); setShowSettings(false) }}
          onDelete={() => setApiKey('')}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  )
}
