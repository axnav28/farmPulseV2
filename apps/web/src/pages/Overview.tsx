import { useEffect, useMemo, useState } from 'react';
import { ActivitySquare, AlertTriangle, Bot, MapPinned, Play, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ActivityFeed from '../components/ActivityFeed';
import AgentStatusPanel, { type AgentCardState } from '../components/AgentStatusPanel';
import PageHeader from '../components/PageHeader';
import RiskMap from '../components/RiskMap';
import { createEventSource, fetchDistricts, runAnalysis } from '../lib/api';
import type { AgentEvent, AgentStatus, AnalysisResponse, DistrictsResponse } from '../types/farmpulse';

const AGENT_NAMES = [
  'Satellite Stress Scout',
  'Crop Risk Analyst',
  'Advisory Generator',
  'Institutional Reporter',
];

const defaultAgentCards: AgentCardState[] = [
  { name: 'Satellite Stress Scout', description: 'Ingests NDVI, freshness, and weather telemetry.', status: 'IDLE' },
  { name: 'Crop Risk Analyst', description: 'Scores risk and enforces agronomy guardrails.', status: 'IDLE' },
  { name: 'Advisory Generator', description: 'Routes multilingual outputs across channels.', status: 'IDLE' },
  { name: 'Institutional Reporter', description: 'Aggregates heat maps, insurer signals, and audit state.', status: 'IDLE' },
];

const trendLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];

function buildAgentStatuses(status: AgentStatus): Record<string, AgentStatus> {
  return Object.fromEntries(AGENT_NAMES.map((name) => [name, status])) as Record<string, AgentStatus>;
}

export default function Overview() {
  const [districtsData, setDistrictsData] = useState<DistrictsResponse | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>(buildAgentStatuses('IDLE'));
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [latestRun, setLatestRun] = useState<AnalysisResponse | null>(null);

  useEffect(() => {
    fetchDistricts()
      .then(setDistrictsData)
      .catch(() => toast.error('Could not load district summaries'))
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => {
    const source = districtsData?.districts.slice(0, 5) ?? [];
    return trendLabels.map((label, index) => ({
      week: label,
      ndvi: Number((0.76 - index * 0.04 - (source[index]?.riskScore ?? 0) / 500).toFixed(2)),
    }));
  }, [districtsData]);

  async function handleRunAnalysis() {
    const runId = crypto.randomUUID();
    setRunning(true);
    setEvents([]);
    setAgentStatuses(buildAgentStatuses('IDLE'));

    const source = createEventSource(runId);
    source.onmessage = (rawEvent) => {
      const payload = JSON.parse(rawEvent.data) as AgentEvent;
      setEvents((current) => [payload, ...current].slice(0, 20));
      if (AGENT_NAMES.includes(payload.agent)) {
        setAgentStatuses((current) => ({ ...current, [payload.agent]: payload.status }));
      }
      if (payload.step === 'complete') {
        source.close();
      }
    };

    try {
      const response = await runAnalysis({
        district: 'Yavatmal',
        crop: 'Cotton',
        language: 'Marathi',
        farmer_query: 'माझ्या कापूस पिकावर पिवळे डाग पडत आहेत. खत कधी द्यावे?',
        run_id: runId,
      });
      setLatestRun(response);
      toast.success('Full analysis complete');
    } catch {
      toast.error('Analysis failed');
      setAgentStatuses(buildAgentStatuses('ERROR'));
    } finally {
      setRunning(false);
      source.close();
    }
  }

  const stats = districtsData?.summary;

  return (
    <div className="mx-auto flex min-h-full max-w-[1680px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Command Center"
        title="FarmPulse Agentic Dashboard"
        description="Live institutional crop-risk intelligence for India’s smallholder network, with visible agent coordination, multilingual advisory output, and a full audit spine."
        action={
          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(31,122,77,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play size={16} />
            {running ? 'Running Agents...' : 'Run Full Analysis'}
          </button>
        }
      />

      <AgentStatusPanel
        agents={defaultAgentCards.map((agent) => ({
          ...agent,
          status: agentStatuses[agent.name] ?? 'IDLE',
        }))}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={MapPinned} label="Districts Monitored" value={stats?.districtsMonitored ?? 0} accent="text-primary" />
        <StatCard icon={AlertTriangle} label="Active Alerts" value={stats?.activeAlerts ?? 0} accent="text-warning" />
        <StatCard icon={Users} label="Farmers Covered" value={stats ? `${(stats.farmersCovered / 1000000).toFixed(0)}M` : '0'} accent="text-emerald-600" />
        <StatCard icon={Bot} label="Last Scan" value={stats ? new Date(stats.lastScanTimestamp).toLocaleTimeString('en-IN') : '--'} accent="text-danger" />
      </div>

      <div className="rounded-[28px] border border-[rgba(31,122,77,0.14)] bg-[linear-gradient(135deg,rgba(31,122,77,0.1),rgba(245,158,11,0.08))] p-6 shadow-[0_18px_48px_rgba(20,44,31,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-muted">Impact Potential</p>
        <p className="mt-3 text-2xl font-semibold leading-tight text-text-main sm:text-[2rem]">₹15K-30K avg seasonal loss prevented × 86M farmers = ₹2.5L Cr addressable impact.</p>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
        <RiskMap districts={districtsData?.districts ?? []} />
        <ActivityFeed events={events} />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-main">NDVI Trend Snapshot</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-text-muted">Synthetic + seeded</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ndviFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f7a4d" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#1f7a4d" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border-color)" />
                <XAxis dataKey="week" stroke="var(--text-muted)" />
                <YAxis domain={[0.4, 0.9]} stroke="var(--text-muted)" />
                <Tooltip />
                <Area type="monotone" dataKey="ndvi" stroke="#1f7a4d" strokeWidth={3} fill="url(#ndviFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
          <h3 className="text-base font-semibold text-text-main">Demo Scenario Pulse</h3>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Centerpiece</p>
              <p className="mt-2 text-lg font-semibold text-text-main">Marathi farmer advisory for Yavatmal cotton</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">Agents ingest NDVI, check weather, reason over bollworm seasonality, and answer back in Marathi with KVK referral guardrails.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Metric label="Latest NDVI" value={latestRun ? latestRun.ndviScore.toFixed(2) : loading ? '...' : '0.52'} />
              <Metric label="Confidence" value={latestRun ? `${latestRun.confidence.toFixed(0)}%` : '93%'} />
              <Metric label="Root Cause" value={latestRun?.riskReport.rootCause ?? 'Probable pink bollworm stress or nitrogen deficiency'} />
              <Metric label="Best Window" value={latestRun?.forecast5d?.[0]?.day ?? 'Fri'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof ActivitySquare;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface-1 p-5 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">{label}</p>
        <Icon className={accent} size={18} />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-text-main">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <p className="mt-2 text-sm leading-6 text-text-main">{value}</p>
    </div>
  );
}
