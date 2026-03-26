import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { exportAuditLogUrl, fetchAuditLog } from '../lib/api';
import type { AuditEntry } from '../types/farmpulse';

export default function AuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [agent, setAgent] = useState('');
  const [district, setDistrict] = useState('');
  const [riskLevel, setRiskLevel] = useState('');

  useEffect(() => {
    fetchAuditLog({ agent: agent || undefined, district: district || undefined, riskLevel: riskLevel || undefined })
      .then((payload) => setEntries(payload.entries))
      .catch(() => toast.error('Could not load audit log'));
  }, [agent, district, riskLevel]);

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

      <div className="grid gap-4 md:grid-cols-3">
        <FilterField label="Agent" value={agent} onChange={setAgent} placeholder="Satellite Stress Scout" />
        <FilterField label="District" value={district} onChange={setDistrict} placeholder="Yavatmal" />
        <FilterField label="Risk Level" value={riskLevel} onChange={setRiskLevel} placeholder="HIGH" />
      </div>

      <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
        <div className="max-h-[calc(100dvh-16rem)] overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-text-muted">
              <tr>
                <th className="px-3 py-3">Timestamp</th>
                <th className="px-3 py-3">Agent</th>
                <th className="px-3 py-3">Action</th>
                <th className="px-3 py-3">District</th>
                <th className="px-3 py-3">Confidence</th>
                <th className="px-3 py-3">Escalation</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={`${entry.runId}-${index}`} className="border-t border-border align-top">
                  <td className="px-3 py-4 text-text-main">{new Date(entry.timestamp).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-4 font-semibold text-text-main">{entry.agent}</td>
                  <td className="px-3 py-4">
                    <p className="text-text-main">{entry.action}</p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-text-muted">{entry.outputSummary}</p>
                  </td>
                  <td className="px-3 py-4 text-text-main">{entry.district}</td>
                  <td className="px-3 py-4 text-text-main">{entry.confidence}%</td>
                  <td className="px-3 py-4 text-text-main">{entry.escalation ? 'Yes' : 'No'}</td>
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
