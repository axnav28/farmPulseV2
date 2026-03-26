import { useEffect, useMemo, useState } from 'react';
import { CloudRain, Droplets, Leaf, Send, Waves } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { createEventSource, fetchDistricts, runFarmerQuery } from '../lib/api';
import type { AgentEvent, AnalysisResponse, DistrictsResponse, ForecastDay } from '../types/farmpulse';

const defaultQuery = 'माझ्या कापूस पिकावर पिवळे डाग पडत आहेत. खत कधी द्यावे?';
const languageOptions = ['Auto', 'Marathi', 'Hindi', 'Punjabi', 'English', 'Bengali', 'Gujarati', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'];

export default function FarmerAdvisory() {
  const [districtsData, setDistrictsData] = useState<DistrictsResponse | null>(null);
  const [district, setDistrict] = useState('Yavatmal');
  const [crop, setCrop] = useState('Cotton');
  const [language, setLanguage] = useState('Auto');
  const [query, setQuery] = useState(defaultQuery);
  const [response, setResponse] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentEvents, setRecentEvents] = useState<AgentEvent[]>([]);

  useEffect(() => {
    fetchDistricts()
      .then(setDistrictsData)
      .catch(() => toast.error('Could not load districts'));
  }, []);

  const currentDistrict = useMemo(
    () => districtsData?.districts.find((item) => item.district === district),
    [districtsData, district],
  );

  const bestDay = useMemo(() => selectBestDay(response?.forecast5d ?? []), [response]);

  async function execute() {
    const runId = crypto.randomUUID();
    setLoading(true);
    setRecentEvents([]);
    const source = createEventSource(runId);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as AgentEvent;
      if (payload.agent !== 'System') {
        setRecentEvents((current) => [payload, ...current].slice(0, 4));
      }
    };

    try {
      const result = await runFarmerQuery({
        district,
        crop,
        language,
        farmer_query: query,
        run_id: runId,
      });
      setResponse(result);
      setLanguage(result.language);
      toast.success(`Advisory ready in ${result.language}`);
    } catch {
      toast.error('Agent run failed');
    } finally {
      setLoading(false);
      source.close();
    }
  }

  function loadSampleScenario() {
    setDistrict('Yavatmal');
    setCrop('Cotton');
    setLanguage('Auto');
    setQuery(defaultQuery);
    setResponse(null);
    setRecentEvents([]);
    toast.success('Sample scenario loaded');
  }

  return (
    <div className='mx-auto flex min-h-full max-w-[1560px] flex-col gap-6 p-4 sm:p-6 lg:p-8'>
      <PageHeader
        eyebrow='Farmer Help'
        title='Multilingual Farmer Advisory'
        description='A Vercel-ready multilingual advisory flow. Enter the farmer query in a supported Indian language and get the response back in that same language.'
      />

      <div className='grid gap-4 xl:grid-cols-3'>
        <StepCard number='1' title='Choose location' text='Select district, crop, and preferred language or keep auto detection.' />
        <StepCard number='2' title='Type the query' text='Paste the farmer question directly in the text box.' />
        <StepCard number='3' title='Get advisory' text='See soil, weather, reasoning, and the farmer-facing answer in the same language.' />
      </div>

      <div className='grid min-h-0 gap-6 2xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]'>
        <section className='min-h-0 space-y-6'>
          <div className='rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
            <div className='flex flex-col items-start justify-between gap-3 sm:flex-row'>
              <div className='min-w-0'>
                <p className='text-sm font-semibold text-text-main'>Enter the farmer question</p>
                <p className='mt-1 text-sm leading-6 text-text-muted'>Text-only flow for reliable Vercel deployment.</p>
              </div>
              <button
                type='button'
                onClick={loadSampleScenario}
                className='rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-text-main'
              >
                Load sample
              </button>
            </div>

            <div className='mt-5 grid gap-4 lg:grid-cols-2'>
              <SelectField label='District' value={district} onChange={setDistrict} options={(districtsData?.districts ?? []).map((item) => item.district)} />
              <SelectField label='Crop' value={crop} onChange={setCrop} options={['Cotton', 'Wheat', 'Rice', 'Soybean', 'Sugarcane', 'Moringa']} />
              <SelectField label='Language' value={language} onChange={setLanguage} options={languageOptions} />
              <ReadOnlyField label='State' value={currentDistrict?.state ?? 'Maharashtra'} />
            </div>

            <div className='mt-5 rounded-3xl border border-border bg-surface-2 p-4'>
              <p className='text-sm font-semibold text-text-main'>Farmer query</p>
              <p className='mt-1 text-sm text-text-muted'>Use Marathi, Hindi, Punjabi, English, or another supported language directly in text.</p>
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={8}
                className='mt-4 w-full rounded-2xl border border-border bg-background px-4 py-4 text-base leading-7 text-text-main outline-none'
                placeholder='Type the farmer question here'
              />
            </div>

            <button
              type='button'
              disabled={loading || !query.trim()}
              onClick={execute}
              className='mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-4 text-base font-semibold text-white disabled:opacity-60'
            >
              <Send size={16} />
              {loading ? 'Checking soil and weather...' : 'Get farmer advice'}
            </button>
          </div>

          <div className='flex min-h-0 flex-col rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
            <p className='text-sm font-semibold text-text-main'>What the agent is checking</p>
            <div className='mt-4 max-h-[16rem] space-y-3 overflow-auto pr-1'>
              {(recentEvents.length ? recentEvents : defaultStatus).map((event, index) => (
                <div key={`${event.agent}-${index}`} className='rounded-2xl border border-border bg-surface-2 p-4'>
                  <p className='text-sm font-semibold text-text-main'>{event.agent}</p>
                  <p className='mt-1 text-sm leading-6 text-text-muted'>{event.message}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className='min-h-0 space-y-6'>
          <div className='grid min-h-0 items-stretch gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]'>
            <div className='flex min-h-[34rem] min-w-0 flex-col rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
              <p className='text-sm font-semibold text-text-main'>Farmer answer</p>
              {!response && (
                <div className='mt-5 rounded-3xl border border-dashed border-border bg-surface-2 p-6'>
                  <p className='text-lg font-semibold text-text-main'>The answer will appear here.</p>
                  <p className='mt-3 text-sm leading-7 text-text-muted'>
                    Type the farmer question and FarmPulse will combine soil conditions, district stress signal, crop stage, and the 5-day forecast before returning a same-language recommendation.
                  </p>
                  <div className='mt-5 grid gap-3 sm:grid-cols-3'>
                    <MiniHint title='Language' text='Auto-detected or manually selected' />
                    <MiniHint title='Soil' text='Moisture, pH, nitrogen' />
                    <MiniHint title='Weather' text='5-day rainfall window' />
                  </div>
                </div>
              )}

              {response && (
                <div className='mt-5 flex-1 space-y-4 overflow-auto pr-1 min-w-0'>
                  <div className={`min-w-0 rounded-3xl p-5 ${response.escalate ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                    <div className='flex min-w-0 flex-col gap-3'>
                      <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase tracking-[0.24em] text-text-muted'>Best farmer-facing answer</p>
                        <p className='mt-2 break-words text-lg font-semibold leading-8 text-text-main sm:text-xl'>{response.escalate ? 'Ground verification needed' : response.advisorySms}</p>
                      </div>
                    </div>
                    <p className='mt-4 whitespace-pre-line break-words text-sm leading-7 text-text-muted'>
                      {response.escalate ? response.escalationReason || response.advisoryWhatsapp : response.advisoryWhatsapp}
                    </p>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2 2xl:grid-cols-4'>
                    <InfoCard icon={Droplets} label='Soil moisture' value={`${response.soilSnapshot.moisturePct}%`} helper={response.soilSnapshot.moistureBand} />
                    <InfoCard icon={Leaf} label='Nitrogen' value={`${response.soilSnapshot.nitrogenKgHa} kg/ha`} helper={response.cropStage} />
                    <InfoCard icon={Waves} label='Soil pH' value={`${response.soilSnapshot.soilPH}`} helper={response.soilSnapshot.summary} />
                    <InfoCard icon={CloudRain} label='Best weather window' value={bestDay ? bestDay.day : '--'} helper={bestDay ? `${bestDay.rainMm} mm rain expected` : 'Available after analysis'} />
                  </div>

                  <div className='rounded-3xl border border-border bg-background p-5'>
                    <p className='text-xs font-semibold uppercase tracking-[0.24em] text-text-muted'>Query used</p>
                    <p className='mt-2 break-words text-base leading-8 text-text-main'>{response.farmerQuery}</p>
                  </div>
                </div>
              )}
            </div>

            <div className='flex min-h-[34rem] min-w-0 flex-col rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
              <p className='text-sm font-semibold text-text-main'>5-day weather</p>
              <p className='mt-1 text-sm text-text-muted'>A drier day is usually safer for fertilizer application.</p>
              <div className='mt-4 flex-1 space-y-3 overflow-auto pr-1'>
                {(response?.forecast5d ?? []).map((day) => (
                  <ForecastRow key={day.date} day={day} highlight={bestDay?.date === day.date} />
                ))}
                {!response && <div className='rounded-2xl border border-dashed border-border bg-surface-2 p-4 text-sm text-text-muted'>Forecast will appear after analysis.</div>}
              </div>
            </div>
          </div>

          {response && (
            <div className='grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]'>
              <div className='flex min-h-[34rem] min-w-0 flex-col rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
                <p className='text-sm font-semibold text-text-main'>Why the agent suggested this</p>
                <div className='mt-4 flex-1 space-y-3 overflow-auto pr-1'>
                  {response.reasoningChain.map((item, index) => (
                    <div key={`${item.title}-${index}`} className='rounded-2xl border border-border bg-surface-2 p-4'>
                      <p className='text-sm font-semibold text-text-main'>Step {index + 1}: {item.title}</p>
                      <p className='mt-1 text-sm leading-6 text-text-muted'>{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className='flex min-h-[34rem] min-w-0 flex-col rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
                <p className='text-sm font-semibold text-text-main'>Quick summary</p>
                <div className='mt-4 flex-1 space-y-3 overflow-auto pr-1'>
                  <SummaryRow label='Language' value={response.language} />
                  <SummaryRow label='Confidence' value={`${response.confidence.toFixed(0)}%`} />
                  <SummaryRow label='Root cause' value={response.riskReport.rootCause} />
                  <SummaryRow label='Recommended action' value={response.riskReport.recommendedAction} />
                  <SummaryRow label='Data sources' value={response.dataSources.join(' • ')} />
                  <SummaryRow label='Warnings' value={response.warnings.join(' | ') || 'None'} />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const defaultStatus: AgentEvent[] = [
  { agent: 'Text Input', step: 'ready', status: 'IDLE', message: 'Waiting for the farmer query.', timestamp: '', run_id: '' },
  { agent: 'Soil + Weather Check', step: 'ready', status: 'IDLE', message: 'Will compare soil conditions with the next 5 days of weather.', timestamp: '', run_id: '' },
  { agent: 'Advisory Generator', step: 'ready', status: 'IDLE', message: 'Will return the answer in the same language as the farmer.', timestamp: '', run_id: '' },
];

function selectBestDay(days: ForecastDay[]) {
  if (!days.length) {
    return null;
  }
  return [...days].sort((a, b) => a.rainMm - b.rainMm || a.maxTempC - b.maxTempC)[0];
}

function StepCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className='rounded-[24px] border border-border bg-surface-1 p-5 shadow-[0_14px_34px_rgba(20,44,31,0.07)]'>
      <div className='flex items-center gap-3'>
        <div className='flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white'>{number}</div>
        <p className='text-base font-semibold text-text-main'>{title}</p>
      </div>
      <p className='mt-3 break-words text-sm leading-6 text-text-muted'>{text}</p>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className='block'>
      <span className='text-xs font-semibold uppercase tracking-[0.24em] text-text-muted'>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className='mt-2 w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-main outline-none'>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className='text-xs font-semibold uppercase tracking-[0.24em] text-text-muted'>{label}</span>
      <div className='mt-2 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-main'>{value}</div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, helper }: { icon: typeof Droplets; label: string; value: string; helper: string }) {
  return (
    <div className='min-w-0 rounded-2xl border border-border bg-surface-2 p-4'>
      <div className='flex items-center justify-between gap-3'>
        <p className='text-xs font-semibold uppercase tracking-[0.2em] text-text-muted'>{label}</p>
        <Icon size={16} className='text-primary' />
      </div>
      <p className='mt-3 break-words text-lg font-semibold text-text-main'>{value}</p>
      <p className='mt-1 break-words text-sm leading-6 text-text-muted'>{helper}</p>
    </div>
  );
}

function ForecastRow({ day, highlight }: { day: ForecastDay; highlight: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${highlight ? 'border-primary/40 bg-emerald-50' : 'border-border bg-surface-2'}`}>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-text-main'>{day.day}</p>
          <p className='text-xs text-text-muted'>{new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
        </div>
        <div className='text-right'>
          <p className='text-sm font-semibold text-text-main'>{day.rainMm} mm</p>
          <p className='text-xs text-text-muted'>{day.minTempC}° / {day.maxTempC}°C</p>
        </div>
      </div>
      <p className='mt-2 text-xs text-text-muted'>{highlight ? 'Best available application window' : day.outlook}</p>
    </div>
  );
}

function MiniHint({ title, text }: { title: string; text: string }) {
  return (
    <div className='min-w-0 rounded-2xl border border-border bg-background p-4'>
      <p className='text-sm font-semibold text-text-main'>{title}</p>
      <p className='mt-1 break-words text-sm leading-6 text-text-muted'>{text}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 rounded-2xl border border-border bg-surface-2 p-4'>
      <p className='text-xs font-semibold uppercase tracking-[0.2em] text-text-muted'>{label}</p>
      <p className='mt-2 break-words text-sm leading-7 text-text-main'>{value}</p>
    </div>
  );
}
