import { formatDistanceToNow } from 'date-fns';
import type { AgentEvent } from '../types/farmpulse';

const agentAccent: Record<string, string> = {
  'Satellite Stress Scout': 'border-sky-500',
  'Crop Risk Analyst': 'border-amber-500',
  'Advisory Generator': 'border-emerald-500',
  'Institutional Reporter': 'border-rose-500',
  'Human Escalation': 'border-red-700',
  Orchestrator: 'border-primary',
  System: 'border-border',
};

export default function ActivityFeed({ events }: { events: AgentEvent[] }) {
  return (
    <div className="min-w-0 rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-text-main">Agent Activity Feed</h3>
        <span className="text-xs uppercase tracking-[0.2em] text-text-muted">Last 20 events</span>
      </div>
      <div className="space-y-3">
        {events.map((event, index) => (
          <div key={`${event.timestamp}-${index}`} className={`rounded-2xl border-l-4 bg-surface-2 p-4 font-mono text-xs ${agentAccent[event.agent] ?? 'border-border'}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-semibold text-text-main">{event.agent}</span>
              <span className="text-text-muted">{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
            </div>
            <p className="mt-2 text-text-main">{event.message}</p>
            <p className="mt-1 uppercase tracking-[0.2em] text-text-muted">{event.status}</p>
          </div>
        ))}
        {!events.length && <p className="rounded-2xl bg-surface-2 p-4 text-sm text-text-muted">Run an analysis to watch the agents work in real time.</p>}
      </div>
    </div>
  );
}
