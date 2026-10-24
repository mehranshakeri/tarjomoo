import * as pdfjsLib from 'pdfjs-dist'

let initialized = false

function init() {
  if (initialized) return
  initialized = true
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
}

export async function loadPdf(file: File): Promise<pdfjsLib.PDFDocumentProxy> {
  init()
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  return loadingTask.promise
}
