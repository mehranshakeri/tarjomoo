'use client'

import { useState, useEffect } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdf } from '@/lib/pdfLoader'

export function usePdfDocument(file: File | null) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const doc = await loadPdf(file!)
        if (!cancelled) { setPdfDoc(doc); setLoading(false) }
      } catch (err) {
        if (!cancelled) { setError(String(err)); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [file])

  return {
    pdfDoc: file ? pdfDoc : null,
    loading: file ? loading : false,
    error: file ? error : null,
  }
}
