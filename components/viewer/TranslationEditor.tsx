import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

interface Props {
  paragraphKey: string
  initialText: string
  isStreaming: boolean
  isSelected: boolean
  error: string | null
  dir: 'rtl' | 'ltr'
  onChange: (key: string, text: string) => void
  onClick: (key: string) => void
}

export function TranslationEditor({
  paragraphKey,
  initialText,
  isStreaming,
  isSelected,
  error,
  dir,
  onChange,
  onClick,
}: Props) {
  const prevTextRef = useRef(initialText)
  const finalSyncedRef = useRef(false)

  const arabicFont = dir === 'rtl' ? '[font-family:var(--font-arabic)]' : ''

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [StarterKit],
    content: initialText || '',
    editorProps: {
      attributes: {
        dir,
        class: `outline-none min-h-[1.4em] text-sm leading-relaxed text-foreground${dir === 'rtl' ? ' [font-family:var(--font-arabic)]' : ''}`,
      },
    },
    onUpdate({ editor: e }) {
      if (!isStreaming) {
        onChange(paragraphKey, e.getText())
      }
    },
  })

  // While streaming: push each chunk into the editor
  useEffect(() => {
    if (!editor || !isStreaming) return
    if (initialText !== prevTextRef.current) {
      prevTextRef.current = initialText
      editor.commands.setContent(initialText || '', { emitUpdate: false })
    }
  }, [editor, initialText, isStreaming])

  // When streaming ends: sync the final text exactly once, then stop touching the editor
  useEffect(() => {
    if (!editor || isStreaming) return
    if (!finalSyncedRef.current) {
      finalSyncedRef.current = true
      if (initialText !== prevTextRef.current) {
        prevTextRef.current = initialText
        editor.commands.setContent(initialText || '', { emitUpdate: false })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, isStreaming])

  const borderColor = isSelected
    ? 'border-l-2 border-blue-400 bg-blue-50/60'
    : 'border-l-2 border-transparent hover:border-amber-300'

  return (
    <div
      dir={dir}
      className={`relative px-3 py-2 rounded cursor-text transition-colors ${borderColor} ${arabicFont}`}
      onClick={() => onClick(paragraphKey)}
    >
      {isStreaming && !initialText && (
        <span className="flex items-center gap-1.5 text-xs text-foreground/40 pointer-events-none">
          <svg
            style={{ width: 11, height: 11, animation: 'spin 1s linear infinite', flexShrink: 0 }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Connecting…
        </span>
      )}
      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
