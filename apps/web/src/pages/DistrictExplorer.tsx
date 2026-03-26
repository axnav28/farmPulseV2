import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import ReasoningChain from '../components/ReasoningChain';
import { fetchDistrictDetail, fetchDistricts } from '../lib/api';
import type { AnalysisResponse, DistrictSummary, DistrictsResponse } from '../types/farmpulse';

export default function DistrictExplorer() {
  const [districtsData, setDistrictsData] = useState<DistrictsResponse | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<AnalysisResponse | null>(null);
  const [filter, setFilter] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchDistricts()
      .then(setDistrictsData)
      .catch(() => toast.error('Could not load district explorer'));
  }, []);

  const filtered = useMemo(() => {
    const items = districtsData?.districts ?? [];
    if (!filter) return items;
    return items.filter((district) =>
      `${district.district} ${district.state} ${district.crop}`.toLowerCase().includes(filter.toLowerCase()),
    );
  }, [districtsData, filter]);

  async function openDistrict(district: DistrictSummary) {
    setLoadingDetail(true);
    try {
      const detail = await fetchDistrictDetail(district.id);
      setSelectedDistrict(detail);
    } catch {
      toast.error('Could not load district reasoning');
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-[1680px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="District Explorer"
        title="District Risk Explorer"
        description="Search every monitored district, inspect full agent reasoning, and generate farmer-facing or institutional responses on demand."
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)] xl:min-h-[42rem] xl:max-h-[calc(100dvh-11rem)]">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-base font-semibold text-text-main">Monitored Districts</h3>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search district, state, or crop"
              className="rounded-full border border-border bg-surface-2 px-4 py-2 text-sm text-text-main outline-none ring-0"
            />
          </div>
          <div className="min-h-0 max-h-[calc(100dvh-16rem)] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <tr>
                  <th className="px-3 py-3">District</th>
                  <th className="px-3 py-3">State</th>
                  <th className="px-3 py-3">Crop</th>
                  <th className="px-3 py-3">NDVI</th>
                  <th className="px-3 py-3">Risk</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((district) => (
                  <tr key={district.id} className="border-t border-border text-text-main">
                    <td className="px-3 py-4 font-semibold">{district.district}</td>
                    <td className="px-3 py-4">{district.state}</td>
                    <td className="px-3 py-4">{district.crop}</td>
                    <td className="px-3 py-4 font-mono">{district.ndviScore.toFixed(2)}</td>
                    <td className="px-3 py-4">
                      <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold">{district.riskLevel}</span>
                    </td>
                    <td className="px-3 py-4">{new Date(district.updatedAt).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        onClick={() => openDistrict(district)}
                        className="rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
                      >
                        Open Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 space-y-6 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto xl:pr-1">
          <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
            <h3 className="text-base font-semibold text-text-main">Selected District</h3>
            {loadingDetail && <p className="mt-4 text-sm text-text-muted">Loading agent reasoning...</p>}
            {!loadingDetail && !selectedDistrict && <p className="mt-4 text-sm text-text-muted">Pick a district to inspect the full RiskReport, multilingual output, and audit trail fragment.</p>}
            {selectedDistrict && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-surface-2 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Risk Report</p>
                  <p className="mt-2 text-lg font-semibold text-text-main">
                    {selectedDistrict.district}, {selectedDistrict.state}
                  </p>
                  <p className="mt-2 text-sm text-text-muted">{selectedDistrict.riskReport.rootCause}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <SummaryMetric label="Risk Score" value={`${selectedDistrict.riskReport.riskScore}/100`} />
                    <SummaryMetric label="Confidence" value={`${selectedDistrict.confidence.toFixed(0)}%`} />
                    <SummaryMetric label="Stage" value={selectedDistrict.cropStage} />
                    <SummaryMetric label="Pest Signal" value={`${selectedDistrict.pestRisk} (${selectedDistrict.pestProbability}%)`} />
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Outputs</p>
                  <p className="mt-2 text-sm font-semibold text-text-main">SMS</p>
                  <p className="mt-1 text-sm leading-6 text-text-muted">{selectedDistrict.advisorySms}</p>
                  <p className="mt-4 text-sm font-semibold text-text-main">Institutional</p>
                  <p className="mt-1 text-sm leading-6 text-text-muted">{selectedDistrict.advisoryInstitutional}</p>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 overflow-hidden">
            <ReasoningChain steps={selectedDistrict?.reasoningChain ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <p className="mt-2 text-sm text-text-main">{value}</p>
    </div>
  );
}
