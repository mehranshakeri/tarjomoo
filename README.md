# tarjomoo

https://tarjomoo.com/

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

Open [http://localhost:5173](http://localhost:5173).

You will need a [Google Gemini API key](https://aistudio.google.com/app/apikey). Enter it via the settings icon in the toolbar — it is stored only in your browser's `localStorage` and never sent anywhere except directly to the Gemini API.

## Stack

| Layer | Library | License |
|---|---|---|
| Build tool | Vite 8 (client-only single-page app) | MIT |
| UI | React 19, Tailwind CSS 4 | MIT |
| PDF rendering | pdfjs-dist | Apache-2.0 |
| OCR | Tesseract.js 7 | Apache-2.0 |
| Rich text editor | Tiptap 3 | MIT |
| Word export | docx 9 | MIT |
| Translation API | Google Gemini (`@google/genai`) | Apache-2.0 |
| Fonts | Geist, Geist Mono, Noto Sans Arabic (self-hosted via Fontsource) | OFL-1.1 |

## Development

The app runs entirely in the browser — there is no server. `npm run build` produces static files in `dist/` that can be served by any static host.

```bash
npm run dev      # start dev server
npm run build    # type check + production build into dist/
npm run preview  # serve the production build locally
npm run lint     # lint
```
