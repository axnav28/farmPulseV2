# FarmPulse

FarmPulse is an agentic crop-risk intelligence platform built for the ET GenAI Hackathon 2026, Track 5: Domain-Specialized Agents. It helps farmers, FPOs, insurers, and government teams act earlier by combining district vegetation stress, weather, crop-stage logic, pest risk, multilingual advisory generation, and auditable agent workflows.

The flagship demo centers on a farmer in Maharashtra asking for help in Marathi. FarmPulse reasons across district conditions and a 5-day forecast, returns actionable guidance in the same language, and then carries the same run into institutional reporting and audit logs.

## Live Links

- Web app: https://web-two-chi-46.vercel.app
- API: https://api-orcin-alpha.vercel.app
- GitHub: https://github.com/axnav28/farmPulseV2

## Core Product

### `/overview`
Command center with live agent status, district coverage, activity feed, and impact framing.

### `/farmer-advisory`
The centerpiece multilingual farmer flow. Farmers can select district, crop, and language, type or speak a query, watch the 4-agent pipeline complete, and receive a same-language answer with confidence, reasoning, and audit linkage.

### `/channel-fallback`
Shows how the same advisory appears as WhatsApp and SMS output for real-world farmer delivery.

### `/districts`
District explorer with NDVI stress heat map, district table, root-cause summaries, reasoning visibility, and vegetation provenance.

### `/mandi-prices`
Mandi price intelligence with crop and district selection plus sell-or-hold framing.

### `/institutional`
Institutional dashboard for FPO, insurer, and government-style reporting, including a stale-data guardrail demo.

### `/audit`
Full audit trail with filters, run-level traceability, and export support.

## Agent Architecture

FarmPulse runs as a 4-agent workflow:

1. Satellite Stress Scout
   Detects vegetation stress and adjusts confidence when freshness degrades.

2. Crop Risk Analyst
   Combines crop stage, weather anomalies, pest pressure, and district context into a structured risk report.

3. Advisory Generator
   Produces farmer-facing guidance in the selected language, including short-format advisory output.

4. Institutional Reporter
   Aggregates each run into report-ready outputs, audit state, and institutional summaries.

## Guardrails

FarmPulse is designed to refuse or escalate when confidence is not good enough.

Visible examples in the product:
- low-confidence farmer case -> escalates to KVK agronomist
- unsupported or uncertain case -> no fabricated recommendation
- stale institutional data -> insurance signal is blocked instead of forwarded
- uncertain vegetation signal -> explicitly marked as lower confidence

## Data Stack

FarmPulse uses a pragmatic real-data stack.

### Weather and Agroclimate
- Open-Meteo for forecast context
- NASA POWER Daily Agroclimatology for observed agroclimate inputs

### Vegetation Signal
FarmPulse does **not** claim pixel-level live satellite extraction in the current deployed version.

Instead, the district vegetation layer is a transparent `reference_snapshot` signal:
- built from live NASA POWER agroclimate observations
- anchored to NASA MODIS vegetation reference ranges
- shown with explicit provenance in the UI
- labeled clearly so demo users are not misled into thinking this is a raw district polygon satellite clip

Official sources:
- NASA POWER Daily Agroclimatology API: https://power.larc.nasa.gov/
- NASA Earthdata MODIS MOD13Q1 reference dataset: https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061
- Open-Meteo: https://open-meteo.com/

### Mandi Pricing
- Agmarknet catalog via data.gov.in when API access is configured
- clearly labeled fallback data when live mandi records are unavailable

## API Surface

- `GET /health`
- `POST /api/analyze`
- `POST /api/farmer-query`
- `POST /api/simulate-edge-case`
- `GET /api/districts`
- `GET /api/district/{district_id}`
- `GET /api/mandi-price`
- `GET /api/audit-log`
- `GET /api/audit-log/export`
- `GET /api/stream/{run_id}`

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Leaflet
- Recharts

### Backend
- FastAPI
- Pydantic
- SQLite
- httpx
- python-dotenv

## Repository Layout

```text
apps/
  api/   FastAPI backend, agent workflow, SSE stream, audit log
  web/   React + TypeScript + Vite frontend
```

## Local Development

### 1. Install web dependencies

```bash
npm install --prefix apps/web
```

### 2. Install backend dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
```

### 3. Configure local API environment

Create `apps/api/.env` with:

```env
POWER_LOOKBACK_DAYS=30
NDVI_CACHE_TTL_SECONDS=43200
```

Optional:
- `AGMARKNET_API_KEY` for live mandi price pulls

### 4. Start the API

```bash
npm run dev:api
```

### 5. Start the web app

```bash
npm run dev:web
```

Open:
- Web: `http://localhost:5173`
- API: `http://127.0.0.1:8000`

## Deployment

The current live stack is deployed on Vercel.

Set this for frontend builds:

```env
VITE_API_BASE=https://api-orcin-alpha.vercel.app
```

## Demo Flow

1. Open `/overview` to show the command center.
2. Open `/farmer-advisory` and run the Maharashtra cotton scenario.
3. Show the 4-agent progress flow, per-agent confidence, and the final advisory.
4. Trigger the escalation demo to show refusal behavior.
5. Open `/channel-fallback` to show WhatsApp and SMS delivery.
6. Open `/mandi-prices` to show economic intelligence beyond crop risk.
7. Open `/institutional` to show stale-data blocking and institutional readiness.
8. Open `/audit` to prove every action is traceable.

## Impact

- `₹15K-30K avg seasonal loss prevented × 86M farmers = ₹2.5L Cr addressable impact.`

## Impact Model

FarmPulse uses order-of-magnitude assumptions that align with the hackathon guidance: state assumptions clearly and use back-of-envelope math only where the logic holds.

| Assumption | Value | Source |
| --- | --- | --- |
| Addressable smallholder farmers | 86M | Agricultural Census 2015-16, operational holdings below 2 hectares |
| Average seasonal income | ₹77,000-₹1,10,000 | NSSO 70th Round (2013), rural cultivator household income range commonly cited for smallholder contexts |
| Crop loss from preventable stress events | 20-40% of seasonal income | NABARD NAFIS 2016-17 and cotton-belt field-loss studies |
| Estimated loss prevented per farmer | ₹15,000-₹30,000 | Derived as 20-40% of average income, assuming one meaningful intervention window per season |
| Total addressable impact | ₹2.5L Cr | ₹30K × 86M upper-bound scenario; this is not a revenue claim |
| Zero-hardware assumption | 100% coverage | No IoT sensor required; NASA POWER and Open-Meteo are free public APIs |

These are order-of-magnitude estimates. Actual impact depends on adoption rate, advisory quality, and farmer follow-through, none of which are claimed here.

## Notes

- The current vegetation layer is intentionally transparent about being a reference snapshot, not a raw district polygon satellite clip.
- The product prioritizes reliability, clarity, and visible agent behavior over hidden automation.
- The repository is structured to be clean, publishable, and easy to demo.
