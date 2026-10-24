# tarjomoo

A browser-based PDF translation tool. Upload a PDF, review the OCR output, sanitize noise, then select paragraphs to translate using the Gemini API.

## Features

- **OCR** — extracts text and images from PDF pages via Tesseract.js (parallelised worker pool)
- **Sanitize** — review and toggle noise blocks, adjust top/bottom noise thresholds
- **Translate** — select one or more paragraphs, translate via Google Gemini with streaming preview
- **Merge** — merge two adjacent paragraphs before translating
- **Glossary** — per-session term glossary injected into every translation prompt
- **DOCX export** — download translated document as Word file, preserving images at their natural aspect ratio
- **RTL support** — Noto Sans Arabic font for Persian, Arabic, Hebrew, Urdu, and related languages

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You will need a [Google Gemini API key](https://aistudio.google.com/app/apikey). Enter it via the settings icon in the toolbar — it is stored only in your browser's `localStorage` and never sent anywhere except directly to the Gemini API.

## Stack

| Layer | Library | License |
|---|---|---|
| Framework | Next.js 16 | MIT |
| UI | React 19, Tailwind CSS 4 | MIT |
| PDF rendering | pdfjs-dist | Apache-2.0 |
| OCR | Tesseract.js 7 | Apache-2.0 |
| Rich text editor | Tiptap 3 | MIT |
| Word export | docx 9 | MIT |
| Translation API | Google Gemini (`@google/genai`) | Apache-2.0 |
| Arabic font | Noto Sans Arabic (via Google Fonts) | OFL-1.1 |

## Development

```bash
npm run dev      # start dev server
npm run build    # production build
npx tsc --noEmit # type check
```
