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

## NDVI Data Pipeline

FarmPulse now uses a practical live-data vegetation signal instead of blocked Earth Engine extraction.

- Backend vegetation scoring combines live NASA POWER agroclimate observations with Open-Meteo forecast context already used elsewhere in the advisory stack.
- The displayed vegetation score is anchored to NASA MODIS vegetation-index reference ranges, so the app is transparent that this is a district-level reference snapshot rather than a pixel-level satellite clip.
- If NASA POWER is temporarily unavailable, the API falls back to a clearly labeled estimate instead of pretending the value is live.

Official sources:

- NASA POWER Daily Agroclimatology API: https://power.larc.nasa.gov/
- NASA Earthdata MODIS MOD13Q1 reference dataset: https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061
- Open-Meteo forecast API: https://open-meteo.com/

### Local Setup

Set these environment variables on the API host or in `apps/api/.env`:

```env
POWER_LOOKBACK_DAYS=30
NDVI_CACHE_TTL_SECONDS=43200
```

No Earth Engine project or service-account registration is required for this path.

## Mandi Price Notes

- The mandi page is wired to the official Agmarknet catalog on data.gov.in.
- If `AGMARKNET_API_KEY` is configured on the API host, FarmPulse attempts a live market fetch for the selected district and crop.
- If live records are unavailable, the UI falls back to clearly labeled demo market samples so the page still works in hackathon and Vercel demos.

## Vercel-Ready Notes

This version removes local speech-to-text and speech synthesis so the project is easier to deploy on Vercel. The farmer advisory flow is text-based and still supports multilingual responses through language detection and district-aware routing.

## Render Backend Deployment

The frontend can stay on Vercel, but the FastAPI backend is a better fit for Render than for Vercel serverless. This repo now includes a root [render.yaml](/Users/arnav/Desktop/code/FarmPulse AI/render.yaml) Blueprint for the API service.

Render setup in this repo:

- `rootDir: apps/api` so the Python service builds from the API app only. Render's monorepo docs note that files outside the configured `rootDir` are not available to the service at build or runtime.
- `buildCommand: pip install -r requirements.txt`
- `startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT`
- `healthCheckPath: /health`
- `FARMPULSE_DB_PATH=/tmp/farmpulse.db` for a simple demo database path

Important persistence note:

- Render documents that the default filesystem is ephemeral. That means the current SQLite audit database is suitable for demos, but not for durable production audit history unless you attach a persistent disk or move to an external database.

To switch the Vercel frontend to the Render backend, set this environment variable in the Vercel web project:

```env
VITE_API_BASE=https://your-render-service.onrender.com
```

A frontend example file is included at [apps/web/.env.example](/Users/arnav/Desktop/code/FarmPulse AI/apps/web/.env.example).

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
- NDVI values now use a NASA POWER and MODIS-referenced vegetation signal, with clear fallback labeling if the live climate feed is unavailable.
- Auditability, multilingual advisory generation, and edge-case escalation are first-class demo features.
- The repository is intentionally structured for public GitHub sharing and straightforward deployment.
