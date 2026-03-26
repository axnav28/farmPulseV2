interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface-1/90 p-6 shadow-[0_20px_60px_rgba(16,42,28,0.12)] lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-main">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
