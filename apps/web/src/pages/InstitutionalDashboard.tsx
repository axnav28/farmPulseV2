import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import RiskMap from '../components/RiskMap';
import { fetchDistricts } from '../lib/api';
import type { DistrictsResponse } from '../types/farmpulse';

export default function InstitutionalDashboard() {
  const [districtsData, setDistrictsData] = useState<DistrictsResponse | null>(null);

  useEffect(() => {
    fetchDistricts()
      .then(setDistrictsData)
      .catch(() => toast.error('Could not load institutional dashboard'));
  }, []);

  const highRisk = useMemo(
    () => (districtsData?.districts ?? []).filter((district) => district.riskLevel === 'HIGH' || district.riskLevel === 'CRITICAL'),
    [districtsData],
  );

  return (
    <div className="mx-auto flex min-h-full max-w-[1680px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Institutional"
        title="FPO, Insurer, and Government Dashboard"
        description="District-level aggregation, pre-claim signals, and PM Digital Agriculture Mission style early-warning outputs for enterprise-ready decisioning."
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <RiskMap districts={districtsData?.districts ?? []} height={500} />

        <div className="min-w-0 space-y-6 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto xl:pr-1">
          <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
            <h3 className="text-base font-semibold text-text-main">Government Early Warning</h3>
            <div className="mt-4 space-y-3">
              {(districtsData?.states ?? []).map((state) => (
                <div key={state.state} className="rounded-2xl bg-surface-2 p-4">
                  <div className="flex items-center justify-between">
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
            <h3 className="text-base font-semibold text-text-main">Insurance Pre-Claim Signals</h3>
            <div className="mt-4 space-y-3">
              {highRisk.slice(0, 8).map((district) => (
                <div key={district.id} className="rounded-2xl border border-border bg-surface-2 p-4">
                  <div className="flex items-center justify-between gap-4">
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
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-main">FPO Briefing Table</h3>
          <span className="rounded-full bg-surface-2 px-4 py-2 text-xs font-semibold text-text-main">JSON-ready output</span>
        </div>
        <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-text-muted">
              <tr>
                <th className="px-3 py-3">District</th>
                <th className="px-3 py-3">State</th>
                <th className="px-3 py-3">Crop</th>
                <th className="px-3 py-3">Risk Score</th>
                <th className="px-3 py-3">Risk Level</th>
                <th className="px-3 py-3">Acreage</th>
              </tr>
            </thead>
            <tbody>
              {(districtsData?.districts ?? []).map((district) => (
                <tr key={district.id} className="border-t border-border">
                  <td className="px-3 py-4 font-semibold text-text-main">{district.district}</td>
                  <td className="px-3 py-4 text-text-main">{district.state}</td>
                  <td className="px-3 py-4 text-text-main">{district.crop}</td>
                  <td className="px-3 py-4 font-mono text-text-main">{district.riskScore}</td>
                  <td className="px-3 py-4 text-text-main">{district.riskLevel}</td>
                  <td className="px-3 py-4 text-text-main">{district.acreageLakh.toFixed(1)} lakh acres</td>
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
