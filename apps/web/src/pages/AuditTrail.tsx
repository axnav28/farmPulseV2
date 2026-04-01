import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { exportAuditLogUrl, fetchAuditLog } from '../lib/api';
import type { AuditEntry } from '../types/farmpulse';

export default function AuditTrail() {
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [agent, setAgent] = useState('');
  const [district, setDistrict] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [runId, setRunId] = useState(searchParams.get('runId') ?? '');

  useEffect(() => {
    fetchAuditLog({ agent: agent || undefined, district: district || undefined, riskLevel: riskLevel || undefined, runId: runId || undefined })
      .then((payload) => setEntries(payload.entries))
      .catch(() => toast.error('Could not load audit log'));
  }, [agent, district, riskLevel, runId]);

  return (
    <div className="mx-auto flex min-h-full max-w-[1680px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Auditability"
        title="Full Agent Audit Trail"
        description="Every agent action is timestamped, confidence-scored, and exportable, so judges can inspect exactly how each decision was made."
        action={
          <a
            href={exportAuditLogUrl()}
            className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white"
          >
            Export CSV
          </a>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FilterField label="Agent" value={agent} onChange={setAgent} placeholder="Satellite Stress Scout" />
        <FilterField label="District" value={district} onChange={setDistrict} placeholder="Yavatmal" />
        <FilterField label="Risk Level" value={riskLevel} onChange={setRiskLevel} placeholder="HIGH" />
        <FilterField label="Run ID" value={runId} onChange={setRunId} placeholder="Open one execution trace" />
      </div>

      <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
        <div className="table-shell touch-scroll overflow-auto xl:max-h-[calc(100dvh-16rem)]">
          <table className="app-table table-sticky min-w-[900px] text-left text-sm">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Agent</th>
                <th>Action</th>
                <th>District</th>
                <th>Confidence</th>
                <th>Escalation</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={`${entry.runId}-${index}`} className="align-top">
                  <td>{new Date(entry.timestamp).toLocaleString('en-IN')}</td>
                  <td className="font-semibold">{entry.agent}</td>
                  <td>
                    <p className="text-text-main">{entry.action}</p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-text-muted">{entry.outputSummary}</p>
                  </td>
                  <td>{entry.district}</td>
                  <td><span className="table-chip">{entry.confidence}%</span></td>
                  <td><span className="table-chip">{entry.escalation ? 'Yes' : 'No'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="rounded-3xl border border-border bg-surface-1 p-4 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
      <span className="text-xs uppercase tracking-[0.2em] text-text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3 w-full rounded-full border border-border bg-surface-2 px-4 py-3 text-sm text-text-main outline-none"
      />
    </label>
  );
}
