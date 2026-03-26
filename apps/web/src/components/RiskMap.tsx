import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import type { DistrictSummary } from '../types/farmpulse';

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

export default function RiskMap({ districts, height = 420 }: { districts: DistrictSummary[]; height?: number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-[0_16px_40px_rgba(20,44,31,0.08)]">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-main">Risk Heat Map</h3>
      </div>
      <div style={{ height }}>
        <MapContainer center={[22.5, 78.5]} zoom={5} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {districts.map((district) => (
            <CircleMarker
              key={district.id}
              center={[district.lat, district.lon]}
              radius={10 + district.riskScore / 18}
              pathOptions={{
                color: colorForRisk(district.riskLevel),
                fillColor: colorForRisk(district.riskLevel),
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
                  <p>NDVI: {district.ndviScore}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
