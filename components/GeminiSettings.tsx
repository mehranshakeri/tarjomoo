import { useState } from 'react'
import { validateGeminiKey } from '@/lib/gemini'

interface Props {
  apiKey: string
  onSave: (key: string) => void
  onDelete: () => void
  onClose: () => void
}

type ValidationState = 'idle' | 'validating' | 'ok' | 'error'

export function GeminiSettings({ apiKey, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState(apiKey)
  const [validation, setValidation] = useState<ValidationState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [deleted, setDeleted] = useState(false)

  function handleDelete() {
    onDelete()
    setDraft('')
    setValidation('idle')
    setErrorMsg('')
    setDeleted(true)
  }

  async function handleValidate() {
    if (!draft.trim()) return
    setValidation('validating')
    setErrorMsg('')
    try {
      await validateGeminiKey(draft.trim())
      setValidation('ok')
    } catch (err) {
      setValidation('error')
      setErrorMsg(err instanceof Error ? err.message : 'Validation failed')
    }
  }

  function handleSave() {
    onSave(draft.trim())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl p-8 w-96 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Translation settings</h2>
          <button
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground/70">Gemini API key</label>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
            >
              Get a free key →
            </a>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setValidation('idle'); setDeleted(false) }}
              placeholder="AIza…"
              className="flex-1 text-sm border border-foreground/20 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 font-mono"
              autoComplete="off"
            />
            <button
              onClick={handleValidate}
              disabled={!draft.trim() || validation === 'validating'}
              className="text-xs px-3 py-2 rounded-lg border border-foreground/20 hover:border-foreground/40 text-foreground/60 hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {validation === 'validating' ? 'Testing…' : 'Test'}
            </button>
          </div>

          {validation === 'ok' && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <span>✓</span> Key works
            </p>
          )}
          {validation === 'error' && (
            <p className="text-xs text-red-500">{errorMsg}</p>
          )}
          {deleted && validation === 'idle' && !draft && (
            <p className="text-xs text-foreground/50 flex items-center gap-1">
              <span>✓</span> API key deleted. You can add a new one above.
            </p>
          )}

          <p className="text-xs text-foreground/40 mt-1">
            Your key is stored locally in your browser and never sent to our servers.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          {apiKey && !deleted ? (
            <button
              onClick={handleDelete}
              className="text-sm px-3 py-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete key
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-foreground/50 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!draft.trim()}
              className="text-sm px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
