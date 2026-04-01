import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import RiskMap from '../components/RiskMap';
import { fetchDistricts, simulateEdgeCase } from '../lib/api';
import type { AnalysisResponse, DistrictsResponse } from '../types/farmpulse';

export default function InstitutionalDashboard() {
  const [districtsData, setDistrictsData] = useState<DistrictsResponse | null>(null);
  const [guardrailDemo, setGuardrailDemo] = useState<AnalysisResponse | null>(null);
  const [guardrailLoading, setGuardrailLoading] = useState(false);

  useEffect(() => {
    fetchDistricts()
      .then(setDistrictsData)
      .catch(() => toast.error('Could not load institutional dashboard'));
  }, []);

  const highRisk = useMemo(
    () => (districtsData?.districts ?? []).filter((district) => district.riskLevel === 'HIGH' || district.riskLevel === 'CRITICAL'),
    [districtsData],
  );

  async function runInstitutionalGuardrailDemo() {
    setGuardrailLoading(true);
    try {
      const result = await simulateEdgeCase({
        scenario: 'data_staleness',
        district: 'Yavatmal',
        crop: 'Cotton',
        language: 'English',
        run_id: crypto.randomUUID(),
      });
      setGuardrailDemo(result);
      toast.success('Institutional guardrail demo ready');
    } catch {
      toast.error('Could not run institutional guardrail demo');
    } finally {
      setGuardrailLoading(false);
    }
  }

  const insuranceBlocked = (guardrailDemo?.dataFreshnessDays ?? 0) > 14;

  return (
    <div className="mx-auto flex min-h-full max-w-[1680px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Institutional"
        title="FPO, Insurer, and Government Dashboard"
        description="District-level aggregation, pre-claim signals, and PM Digital Agriculture Mission style early-warning outputs for enterprise-ready decisioning."
      />

      <div className="rounded-3xl border border-amber-200 bg-[linear-gradient(135deg,#fff7ed,#fef3c7)] p-5 shadow-[0_16px_40px_rgba(120,53,15,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">Institutional guardrail demo</p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-800">If NDVI data is older than 14 days, the insurance pre-claim signal is blocked for manual review instead of being forwarded downstream.</p>
          </div>
          <button
            type="button"
            onClick={runInstitutionalGuardrailDemo}
            disabled={guardrailLoading}
            className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-60"
          >
            <ShieldAlert size={16} />
            {guardrailLoading ? 'Running guardrail...' : 'Trigger stale-data guardrail'}
          </button>
        </div>

        {guardrailDemo && (
          <div className={`mt-4 rounded-2xl border p-4 ${insuranceBlocked ? 'border-red-300 bg-red-50' : 'border-emerald-300 bg-emerald-50'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${insuranceBlocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${insuranceBlocked ? 'text-red-700' : 'text-emerald-700'}`}>
                  {insuranceBlocked ? 'Insurance signal blocked' : 'Insurance signal cleared'}
                </p>
                <p className={`mt-2 text-base font-semibold leading-7 ${insuranceBlocked ? 'text-red-950' : 'text-emerald-900'}`}>
                  {insuranceBlocked
                    ? `NDVI data is ${guardrailDemo.dataFreshnessDays} days old. Pre-claim forwarding stopped and flagged for manual review.`
                    : `NDVI data freshness is ${guardrailDemo.dataFreshnessDays} days. Pre-claim signal can proceed.`}
                </p>
                <p className={`mt-2 text-sm leading-6 ${insuranceBlocked ? 'text-red-900' : 'text-emerald-900'}`}>
                  {insuranceBlocked
                    ? 'Compliance guardrail enforced: stale satellite data cannot be used for insurer action without revalidation.'
                    : 'Freshness is within the institutional policy window.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <RiskMap districts={districtsData?.districts ?? []} height={500} />

        <div className="min-w-0 space-y-6 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto xl:pr-1">
          <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
            <h3 className="text-base font-semibold text-text-main">Government Early Warning</h3>
            <div className="mt-4 space-y-3">
              {(districtsData?.states ?? []).map((state) => (
                <div key={state.state} className="rounded-2xl bg-surface-2 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-text-main">{state.state}</p>
                    <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-text-main">
                      Avg Risk {state.avgRisk}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-muted">
                    {state.criticalDistricts} critical districts across {state.districtCount} monitored districts
                    {state.emergencyAlert ? ' • emergency alert threshold met' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-text-main">Insurance Pre-Claim Signals</h3>
                <p className="mt-1 text-sm text-text-muted">High-risk districts are surfaced only when data freshness passes institutional policy checks.</p>
              </div>
              {guardrailDemo && insuranceBlocked && (
                <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">Blocked: stale NDVI</span>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {guardrailDemo && insuranceBlocked ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-900">Pre-claim routing paused</p>
                  <p className="mt-2 text-sm leading-6 text-red-800">Yavatmal cotton is intentionally withheld from insurer forwarding because the NDVI source is {guardrailDemo.dataFreshnessDays} days old. Revalidation is required before any pre-claim action.</p>
                </div>
              ) : (
                highRisk.slice(0, 8).map((district) => (
                  <div key={district.id} className="rounded-2xl border border-border bg-surface-2 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-text-main">{district.district}</p>
                        <p className="text-sm text-text-muted">{district.state} • {district.crop}</p>
                      </div>
                      <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-text-main">{district.riskLevel}</span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <InfoLine label="Estimated affected acreage" value={`${Math.min(48, (district.riskScore * 0.42)).toFixed(1)}%`} />
                      <InfoLine label="Claim probability score" value={(district.riskScore / 110).toFixed(2)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-text-main">FPO Briefing Table</h3>
          <span className="rounded-full bg-surface-2 px-4 py-2 text-xs font-semibold text-text-main">JSON-ready output</span>
        </div>
        <div className="table-shell touch-scroll overflow-auto xl:max-h-[calc(100dvh-18rem)]">
          <table className="app-table table-sticky min-w-[720px] text-left text-sm">
            <thead>
              <tr>
                <th>District</th>
                <th>State</th>
                <th>Crop</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Acreage</th>
              </tr>
            </thead>
            <tbody>
              {(districtsData?.districts ?? []).map((district) => (
                <tr key={district.id}>
                  <td className="font-semibold">{district.district}</td>
                  <td>{district.state}</td>
                  <td>{district.crop}</td>
                  <td className="font-mono">{district.riskScore}</td>
                  <td><span className="table-chip">{district.riskLevel}</span></td>
                  <td>{district.acreageLakh.toFixed(1)} lakh acres</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <p className="mt-2 text-sm text-text-main">{value}</p>
    </div>
  );
}
