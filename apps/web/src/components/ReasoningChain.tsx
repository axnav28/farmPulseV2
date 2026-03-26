export default function ReasoningChain({ steps }: { steps: Array<{ title: string; detail: string }> }) {
  return (
    <div className="rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-main">Reasoning Chain</h3>
        <span className="text-xs uppercase tracking-[0.2em] text-text-muted">Visible by design</span>
      </div>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={`${step.title}-${index}`} className="relative pl-12">
            {index < steps.length - 1 && <div className="absolute left-5 top-10 h-[calc(100%+0.5rem)] w-px bg-border" />}
            <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
              {index + 1}
            </div>
            <div className="rounded-2xl bg-surface-2 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
                <span className="text-emerald-500">✓</span>
                <span>{step.title}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-text-muted">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
