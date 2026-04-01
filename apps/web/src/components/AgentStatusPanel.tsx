import clsx from 'clsx';
import type { AgentStatus } from '../types/farmpulse';

export interface AgentCardState {
  name: string;
  description: string;
  status: AgentStatus;
}

const statusStyles: Record<AgentStatus, string> = {
  IDLE: 'border-border bg-surface-2 text-text-muted',
  RUNNING: 'border-primary/40 bg-primary/10 text-primary',
  COMPLETE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  ERROR: 'border-danger/40 bg-danger/10 text-danger',
};

export default function AgentStatusPanel({ agents }: { agents: AgentCardState[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {agents.map((agent) => (
        <div key={agent.name} className="rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-main">{agent.name}</h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">{agent.description}</p>
            </div>
            <div className={clsx('flex h-10 w-10 items-center justify-center rounded-full border', statusStyles[agent.status])}>
              <span className={clsx('h-3 w-3 rounded-full', agent.status === 'RUNNING' && 'animate-pulse bg-primary', agent.status === 'COMPLETE' && 'bg-emerald-500', agent.status === 'ERROR' && 'bg-danger', agent.status === 'IDLE' && 'bg-slate-400')} />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <span className={clsx('relative flex h-3 w-3', agent.status === 'RUNNING' && 'after:absolute after:inset-0 after:animate-ping after:rounded-full after:bg-primary/50')}>
              <span className={clsx('inline-flex h-3 w-3 rounded-full', agent.status === 'RUNNING' && 'bg-primary', agent.status === 'COMPLETE' && 'bg-emerald-500', agent.status === 'ERROR' && 'bg-danger', agent.status === 'IDLE' && 'bg-slate-400')} />
            </span>
            <span className="text-xs font-medium tracking-[0.2em] text-text-muted">{agent.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
