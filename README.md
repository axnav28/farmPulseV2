# FarmPulse

FarmPulse is an agentic crop-risk intelligence platform built for the ET GenAI Hackathon 2026 Track 5 challenge. This repository is organized as a clean multi-app workspace so the frontend, backend, and deployment surfaces are easy to understand and publish.

## Structure

```text
apps/
  api/   FastAPI multi-agent engine, SSE progress stream, SQLite audit log
  web/   React + TypeScript + Vite frontend for dashboards and demo flows
```

## Key Flows

- `/overview`: command center with live agent status, heat map, and activity feed
- `/districts`: district explorer with visible reasoning chain and NDVI provenance labels
- `/farmer-advisory`: multilingual farmer advisory centerpiece demo using typed input
- `/channel-fallback`: WhatsApp and SMS delivery mockups for real field deployment
- `/mandi-prices`: mandi price intelligence with sell-or-hold guidance and Agmarknet source wiring
- `/institutional`: FPO, insurer, and government reporting views
- `/audit`: full agent audit trail with export support

## NDVI Data Transparency

The current demo does not claim live per-district satellite extraction.

- District NDVI values shown in the UI are demo estimates generated from crop-season baselines, district stress profiles, and freshness rules.
- Those values are intentionally labeled against official NASA MODIS vegetation-index reference ranges so the UI is transparent about the source basis.
- In the district explorer, every NDVI map value and district detail panel is marked as `demo-estimated` rather than `live satellite`.

Official reference used for NDVI range alignment:

- NASA Earthdata MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061 (MOD13Q1): https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061

Weather source:

- Open-Meteo forecast API: https://open-meteo.com/

If you later want true observed district NDVI instead of demo-estimated values, the next step is to ingest actual MODIS or other satellite rasters and aggregate them to district geometry boundaries before serving them from the API.

## Mandi Price Notes

- The mandi page is wired to the official Agmarknet catalog on data.gov.in.
- If `AGMARKNET_API_KEY` is configured on the API host, FarmPulse attempts a live market fetch for the selected district and crop.
- If live records are unavailable, the UI falls back to clearly labeled demo market samples so the page still works in hackathon and Vercel demos.

## Vercel-Ready Notes

This version removes local speech-to-text and speech synthesis so the project is easier to deploy on Vercel. The farmer advisory flow is text-based and still supports multilingual responses through language detection and district-aware routing.

## Local Development

### 1. Install the web app

```bash
npm install --prefix apps/web
```

### 2. Install the API dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
```

### 3. Start the API

```bash
npm run dev:api
```

### 4. Start the web app

```bash
npm run dev:web
```

Open:

- Web: `http://localhost:5173`
- API: `http://127.0.0.1:8000`
- API health: `http://127.0.0.1:8000/health`

The frontend expects the API on `http://127.0.0.1:8000` during local development.

## Notes

- The backend uses Open-Meteo weather with retry and fallback behavior.
- NDVI values are clearly labeled as demo-estimated until a real satellite ingest pipeline is added.
- Auditability, multilingual advisory generation, and edge-case escalation are first-class demo features.
- The repository is intentionally structured for public GitHub sharing and straightforward deployment.
