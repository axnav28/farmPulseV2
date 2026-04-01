import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MessageCircleMore, RadioTower, Send, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { fetchDistricts, runFarmerQuery } from '../lib/api';
import type { AnalysisResponse, DistrictsResponse } from '../types/farmpulse';

const languageOptions = ['Marathi', 'Hindi', 'Punjabi', 'English'];
const cropOptions = ['Cotton', 'Wheat', 'Rice', 'Soybean', 'Sugarcane'];
const sampleQueries: Record<string, string> = {
  Marathi: 'माझ्या कापूस पिकावर पिवळे डाग पडत आहेत. खत कधी द्यावे?',
  Hindi: 'मेरी कपास की फसल की पत्तियां पीली पड़ रही हैं। खाद कब डालूं?',
  Punjabi: 'ਮੇਰੀ ਕਪਾਹ ਦੀ ਫਸਲ ਦੇ ਪੱਤੇ ਪੀਲੇ ਹੋ ਰਹੇ ਹਨ। ਖਾਦ ਕਦੋਂ ਪਾਵਾਂ?',
  English: 'My cotton crop leaves are turning yellow. When should I apply fertilizer?',
};

export default function ChannelFallback() {
  const [districtsData, setDistrictsData] = useState<DistrictsResponse | null>(null);
  const [district, setDistrict] = useState('Yavatmal');
  const [crop, setCrop] = useState('Cotton');
  const [language, setLanguage] = useState('Marathi');
  const [query, setQuery] = useState(sampleQueries.Marathi);
  const [response, setResponse] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDistricts()
      .then(setDistrictsData)
      .catch(() => toast.error('Could not load districts'));
  }, []);

  const currentDistrict = useMemo(
    () => districtsData?.districts.find((item) => item.district === district),
    [districtsData, district],
  );

  useEffect(() => {
    setQuery(sampleQueries[language] ?? sampleQueries.Marathi);
  }, [language]);

  async function generatePreview() {
    setLoading(true);
    try {
      const advisory = await runFarmerQuery({
        district,
        crop,
        language,
        farmer_query: query,
        run_id: crypto.randomUUID(),
      });
      setResponse(advisory);
      toast.success('Channel preview ready');
    } catch {
      toast.error('Could not build channel preview');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-[1640px] flex-col gap-7 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Delivery Channels"
        title="WhatsApp and SMS Fallback"
        description="This page shows exactly how the same farmer advisory would land on a smartphone or feature phone, which is closer to real field deployment than a dashboard-only demo."
      />

      <div className="grid gap-7 xl:grid-cols-[minmax(300px,440px)_minmax(0,1fr)]">
        <section className="rounded-[30px] border border-border bg-surface-1 p-6 shadow-[0_20px_48px_rgba(20,44,31,0.10)]">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Compose advisory</p>
              <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.02em] text-text-main">Build the farmer-facing message pack</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="District" value={district} onChange={setDistrict} options={districtsData?.districts.map((item) => item.district) ?? []} />
              <SelectField label="Crop" value={crop} onChange={setCrop} options={cropOptions} />
              <SelectField label="Language" value={language} onChange={setLanguage} options={languageOptions} />
              <div className="rounded-[24px] border border-border bg-surface-3 px-4 py-4 text-[0.95rem] text-text-muted">
                <p className="text-xs uppercase tracking-[0.16em] text-text-muted">KVK</p>
                <p className="mt-2 text-text-main">{currentDistrict?.district ?? district}</p>
                <p className="mt-1">Field verification contact ready in every high-risk advisory.</p>
              </div>
            </div>
            <label className="block rounded-[24px] border border-border bg-surface-3 p-4">
              <span className="text-xs uppercase tracking-[0.16em] text-text-muted">Farmer query</span>
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={4}
                className="mt-3 w-full resize-none bg-transparent text-[1rem] leading-7 text-text-main outline-none"
              />
            </label>
            <button
              type="button"
              onClick={generatePreview}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-[0.98rem] font-semibold text-white shadow-[0_16px_34px_rgba(26,58,42,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={16} />
              {loading ? 'Generating preview...' : 'Generate channel preview'}
            </button>
          </div>
        </section>

        <section className="grid min-w-0 gap-7 lg:grid-cols-2">
          <PhoneFrame title="WhatsApp advisory" subtitle="Smartphone delivery" icon={<MessageCircleMore size={18} />} accent="bg-[#e7f7ee]">
            <div className="space-y-3 text-sm leading-6 text-text-main">
              <ChatBubble tone="incoming">{query}</ChatBubble>
              <ChatBubble tone="outgoing">{response?.advisoryWhatsapp ?? 'Generate the preview to see the advisory in WhatsApp format.'}</ChatBubble>
            </div>
            <div className="mt-4 rounded-2xl bg-white/80 p-3 text-xs leading-5 text-text-muted">
              <p>Delivery path: smartphone app</p>
              <p>Rich message: yes</p>
              <p>Language: {response?.language ?? language}</p>
            </div>
          </PhoneFrame>

          <PhoneFrame title="SMS fallback" subtitle="Feature-phone delivery" icon={<RadioTower size={18} />} accent="bg-[#f3f4f6]">
            <div className="rounded-[22px] border border-slate-200 bg-white p-4 text-sm leading-6 text-text-main shadow-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">FarmPulse Alert</p>
              <p className="mt-3 break-words">{response?.advisorySms ?? 'Generate the preview to see the SMS-safe message.'}</p>
            </div>
            <div className="mt-4 rounded-2xl bg-white/80 p-3 text-xs leading-5 text-text-muted">
              <p>Delivery path: SMS gateway</p>
              <p>Character-safe format: yes</p>
              <p>Fallback use: low-data and non-smartphone users</p>
            </div>
          </PhoneFrame>
        </section>
      </div>

      <section className="grid gap-5 xl:grid-cols-3">
        <MiniInfoCard title="Deployment realism" text="The same advisory is rendered for WhatsApp and SMS because most farmers will consume advice through a messaging channel, not a dashboard." />
        <MiniInfoCard title="Fallback logic" text="If WhatsApp is unavailable, the short SMS advisory is still actionable and keeps the KVK escalation path intact." />
        <MiniInfoCard title="Operator view" text="This page makes the advisory payload tangible for judges, telecom partners, and FPO operations teams." />
      </section>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block rounded-[22px] border border-border bg-surface-3 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
      <span className="text-xs uppercase tracking-[0.16em] text-text-muted">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full bg-transparent text-[1rem] text-text-main outline-none">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PhoneFrame({
  title,
  subtitle,
  icon,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[40px] border border-border bg-surface-1 p-4 shadow-[0_24px_56px_rgba(20,44,31,0.12)] sm:p-5">
      <div className="mx-auto flex w-full max-w-[350px] flex-col rounded-[32px] border-[8px] border-[#111827] bg-[#0f172a] p-3 shadow-[0_26px_60px_rgba(15,23,42,0.30)] sm:rounded-[36px] sm:border-[10px] sm:p-3.5">
        <div className="mx-auto mb-3 h-1.5 w-24 rounded-full bg-white/20" />
        <div className={'rounded-[24px] p-4 sm:rounded-[26px] ' + accent}>
          <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-3">
            <div className="flex items-center gap-3 text-text-main">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary">{icon}</div>
              <div>
                <p className="text-[1rem] font-semibold tracking-[-0.02em]">{title}</p>
                <p className="text-[0.82rem] text-text-muted">{subtitle}</p>
              </div>
            </div>
            <Smartphone size={18} className="text-text-muted" />
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ tone, children }: { tone: 'incoming' | 'outgoing'; children: ReactNode }) {
  const toneClass = tone === 'outgoing' ? 'ml-6 bg-[#dcf8c6] sm:ml-8' : 'mr-6 bg-white sm:mr-8';
  return <div className={'rounded-[22px] px-4 py-3.5 text-[0.98rem] leading-7 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ' + toneClass}>{children}</div>;
}

function MiniInfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_44px_rgba(20,44,31,0.10)]">
      <p className="text-[1.02rem] font-semibold tracking-[-0.02em] text-text-main">{title}</p>
      <p className="mt-2 text-[0.98rem] leading-7 text-text-muted">{text}</p>
    </div>
  );
}
