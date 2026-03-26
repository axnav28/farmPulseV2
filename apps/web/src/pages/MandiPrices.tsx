import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BadgeIndianRupee, CalendarDays, LineChart, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { fetchDistricts, fetchMandiPrice } from '../lib/api';
import type { DistrictsResponse, MandiPriceResponse } from '../types/farmpulse';

const cropOptions = ['Cotton', 'Wheat', 'Rice', 'Soybean', 'Sugarcane'];

export default function MandiPrices() {
  const [districtsData, setDistrictsData] = useState<DistrictsResponse | null>(null);
  const [district, setDistrict] = useState('Yavatmal');
  const [crop, setCrop] = useState('Cotton');
  const [priceData, setPriceData] = useState<MandiPriceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDistricts()
      .then(setDistrictsData)
      .catch(() => toast.error('Could not load districts'));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPrice() {
      setLoading(true);
      try {
        const result = await fetchMandiPrice({ district, crop });
        if (!cancelled) {
          setPriceData(result);
        }
      } catch {
        if (!cancelled) {
          toast.error('Could not load mandi price');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPrice();
    return () => {
      cancelled = true;
    };
  }, [district, crop]);

  const currentDistrict = useMemo(
    () => districtsData?.districts.find((item) => item.district === district),
    [districtsData, district],
  );

  return (
    <div className="mx-auto flex min-h-full max-w-[1640px] flex-col gap-7 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Mandi Intelligence"
        title="Live Mandi Price Intelligence"
        description="Crop risk is only half the decision. This page adds mandi economics so the farmer or FPO can decide whether to sell now, hold, or stagger sale based on the latest district market signal."
      />

      <section className="grid gap-7 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_44px_rgba(20,44,31,0.10)]">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Select market context</p>
              <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.02em] text-text-main">District and crop</h2>
            </div>
            <SelectField label="District" value={district} onChange={setDistrict} options={districtsData?.districts.map((item) => item.district) ?? []} />
            <SelectField label="Crop" value={crop} onChange={setCrop} options={cropOptions} />
            <div className="rounded-[24px] border border-border bg-surface-3 p-4 text-[0.98rem] leading-7 text-text-muted">
              <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-muted">Farmer-facing answer</p>
              <p className="mt-3 text-base font-semibold text-text-main">
                {priceData
                  ? priceData.crop + ' is fetching ₹' + priceData.modalPrice.toLocaleString('en-IN') + '/' + priceData.unit + ' in ' + priceData.market + ' today.'
                  : 'Loading mandi answer...'}
              </p>
              <p className="mt-2">{priceData?.recommendation ?? 'Waiting for market signal.'}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-7">
          <div className="rounded-[30px] border border-border bg-surface-1 p-7 shadow-[0_22px_52px_rgba(20,44,31,0.10)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Market snapshot</p>
                <h2 className="mt-2 text-[2.5rem] font-semibold tracking-[-0.05em] text-text-main">
                  {loading || !priceData ? 'Loading...' : '₹' + priceData.modalPrice.toLocaleString('en-IN')}
                </h2>
                <p className="mt-2 text-[1rem] leading-7 text-text-muted">
                  {priceData ? priceData.market + ', ' + priceData.district + ' · ' + priceData.priceDate : 'Fetching mandi price signal'}
                </p>
              </div>
              {priceData ? (
                <div className={'inline-flex rounded-full px-4 py-2 text-sm font-semibold ' + (priceData.live ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                  {priceData.live ? 'Live Agmarknet feed' : 'Fallback sample'}
                </div>
              ) : null}
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-4">
              <MetricCard icon={<BadgeIndianRupee size={16} />} label="Modal price" value={priceData ? '₹' + priceData.modalPrice.toLocaleString('en-IN') : '--'} />
              <MetricCard icon={<LineChart size={16} />} label="Benchmark" value={priceData ? '₹' + priceData.benchmarkPrice.toLocaleString('en-IN') : '--'} />
              <MetricCard icon={<Store size={16} />} label="Market" value={priceData?.market ?? '--'} />
              <MetricCard icon={<CalendarDays size={16} />} label="Trend" value={priceData?.trend ?? '--'} />
            </div>
          </div>

          <div className="grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_44px_rgba(20,44,31,0.10)]">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Sell or hold</p>
              <h3 className="mt-2 text-[1.45rem] font-semibold tracking-[-0.03em] text-text-main">{priceData?.recommendationShort ?? 'Loading recommendation'}</h3>
              <p className="mt-4 text-[1rem] leading-8 text-text-muted">{priceData?.recommendation ?? 'Waiting for price recommendation.'}</p>
              <div className="mt-5 rounded-[24px] border border-border bg-surface-3 p-4 text-[0.98rem] leading-7 text-text-muted">
                <p>
                  {priceData
                    ? 'For ' + (currentDistrict?.district ?? district) + ' farmers growing ' + crop.toLowerCase() + ', FarmPulse combines market realization with district crop-risk context so a high-risk crop is not blindly held only for a small price upside.'
                    : 'Preparing combined market guidance.'}
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_44px_rgba(20,44,31,0.10)]">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Source and trust</p>
              <p className="mt-3 text-[1.02rem] font-semibold tracking-[-0.02em] text-text-main">{priceData?.sourceName ?? 'Loading source'}</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">{priceData?.note ?? 'Waiting for source note.'}</p>
              {priceData ? (
                <a href={priceData.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-semibold text-primary">
                  View official source
                </a>
              ) : null}
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <SmallStat label="Min" value={priceData ? '₹' + priceData.minPrice.toLocaleString('en-IN') : '--'} />
                <SmallStat label="Modal" value={priceData ? '₹' + priceData.modalPrice.toLocaleString('en-IN') : '--'} />
                <SmallStat label="Max" value={priceData ? '₹' + priceData.maxPrice.toLocaleString('en-IN') : '--'} />
              </div>
            </div>
          </div>
        </div>
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

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-border bg-surface-3 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <p className="text-[0.72rem] uppercase tracking-[0.22em]">{label}</p>
      </div>
      <p className="mt-3 text-[1.2rem] font-semibold tracking-[-0.02em] text-text-main">{value}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-border bg-surface-3 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
      <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-muted">{label}</p>
      <p className="mt-2 text-[1rem] font-semibold tracking-[-0.02em] text-text-main">{value}</p>
    </div>
  );
}
