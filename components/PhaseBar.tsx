interface PhaseBarProps {
  activeStep: 0 | 1 | 2
}

const STEPS = [
  { label: 'OCR',       hint: 'Review OCR output, then click Sanitize →' },
  { label: 'Sanitize',  hint: 'Trim noise, then click Continue to Translate →' },
  { label: 'Translate', hint: 'Select paragraphs and run translation, use Shift+Click to select multiple texts' },
] as const

export function PhaseBar({ activeStep }: PhaseBarProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => {
          const isActive = i === activeStep
          const isDone = i < activeStep

          const dot = isActive
            ? 'w-2 h-2 rounded-full bg-foreground/70 ring-2 ring-foreground/15 ring-offset-1'
            : isDone
              ? 'w-1.5 h-1.5 rounded-full bg-foreground/40'
              : 'w-1.5 h-1.5 rounded-full bg-foreground/15'

          const label = isActive
            ? 'text-xs font-medium text-foreground'
            : isDone
              ? 'text-xs text-foreground/50'
              : 'text-xs text-foreground/25'

          return (
            <div key={step.label} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-8 h-px ${i <= activeStep ? 'bg-foreground/20' : 'bg-foreground/10'}`} />
              )}
              <div className="flex items-center gap-1.5">
                <div className={dot} />
                <span className={label}>{step.label}</span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-foreground/40">{STEPS[activeStep].hint}</p>
    </div>
  )
}
