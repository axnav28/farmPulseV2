import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import type { DistrictSummary } from '../types/farmpulse';

type MapMetric = 'risk' | 'ndvi';

function colorForRisk(level: DistrictSummary['riskLevel']) {
  switch (level) {
    case 'CRITICAL':
      return '#991b1b';
    case 'HIGH':
      return '#ef4444';
    case 'MEDIUM':
      return '#f59e0b';
    default:
      return '#1f7a4d';
  }
}

function colorForNdvi(ndvi: number) {
  if (ndvi >= 0.76) return '#166534';
  if (ndvi >= 0.68) return '#22c55e';
  if (ndvi >= 0.6) return '#84cc16';
  if (ndvi >= 0.52) return '#f59e0b';
  return '#dc2626';
}

function radiusForNdvi(ndvi: number) {
  return 22000 + Math.max(0, (0.85 - ndvi) * 70000);
}

function Legend({ metric }: { metric: MapMetric }) {
  const items =
    metric === 'ndvi'
      ? [
          { label: '0.76+', color: '#166534' },
          { label: '0.68-0.75', color: '#22c55e' },
          { label: '0.60-0.67', color: '#84cc16' },
          { label: '0.52-0.59', color: '#f59e0b' },
          { label: '<0.52', color: '#dc2626' },
        ]
      : [
          { label: 'Low', color: '#1f7a4d' },
          { label: 'Medium', color: '#f59e0b' },
          { label: 'High', color: '#ef4444' },
          { label: 'Critical', color: '#991b1b' },
        ];

  return (
    <div className="flex flex-wrap gap-3 border-t border-border px-5 py-3 text-xs text-text-muted">
      {items.map((item) => (
        <div key={item.label} className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function RiskMap({
  districts,
  height = 420,
  metric = 'risk',
  title,
}: {
  districts: DistrictSummary[];
  height?: number;
  metric?: MapMetric;
  title?: string;
}) {
  const mapTitle = title ?? (metric === 'ndvi' ? 'NDVI Heat Map' : 'Risk Heat Map');
  const mapHeight = `clamp(18rem, 48vw, ${height}px)`;
  const ndviMeta = districts[0]?.ndviMeta;
  const ndviDescription = ndviMeta?.mode === 'reference_snapshot'
    ? 'District vegetation signal is rendered as a green-to-red stress layer using live NASA POWER observations anchored to MODIS reference ranges.'
    : 'District vegetation signal is rendered as a green-to-red stress layer. When live NASA POWER access is unavailable, FarmPulse falls back to clearly labeled reference-aligned estimates.';

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
      <div className="border-b border-border px-5 py-4">
        <div className="max-w-5xl">
          <h3 className="text-base font-semibold text-text-main">{mapTitle}</h3>
          <p className="mt-1 text-sm text-text-muted">
            {metric === 'ndvi' ? ndviDescription : 'District risk is rendered from low to critical to show where attention is needed fastest.'}
          </p>
          {metric === 'ndvi' && ndviMeta ? (
            <div className="mt-4 w-full max-w-4xl rounded-2xl border border-border bg-surface-2 px-4 py-3 text-xs leading-5 text-text-muted">
              <p className="font-semibold uppercase tracking-[0.18em] text-text-main">NDVI Source</p>
              <p className="mt-1">{ndviMeta.displayLabel}</p>
              <p>{ndviMeta.sourceName} · {ndviMeta.resolution}</p>
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ height: mapHeight }}>
        <MapContainer center={[22.5, 78.5]} zoom={5} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {districts.map((district) => {
            const color = metric === 'ndvi' ? colorForNdvi(district.ndviScore) : colorForRisk(district.riskLevel);

            return metric === 'ndvi' ? (
              <Circle
                key={district.id}
                center={[district.lat, district.lon]}
                radius={radiusForNdvi(district.ndviScore)}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.22,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold">{district.district}</p>
                    <p>{district.state}</p>
                    <p>{district.crop}</p>
                    <p>NDVI: {district.ndviScore.toFixed(2)}</p>
                    <p>Baseline: {district.baseline.toFixed(2)}</p>
                    <p>Risk: {district.riskLevel}</p>
                    <p className="pt-1 text-xs text-slate-600">{district.ndviMeta.displayLabel}</p>
                  </div>
                </Popup>
              </Circle>
            ) : (
              <CircleMarker
                key={district.id}
                center={[district.lat, district.lon]}
                radius={10 + district.riskScore / 18}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.55,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold">{district.district}</p>
                    <p>{district.state}</p>
                    <p>{district.crop}</p>
                    <p>Risk: {district.riskLevel}</p>
                    <p>NDVI: {district.ndviScore.toFixed(2)}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      <Legend metric={metric} />
    </div>
  );
}
