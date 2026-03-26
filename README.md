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
- `/districts`: district explorer with visible reasoning chain
- `/farmer-advisory`: multilingual farmer advisory centerpiece demo using typed input
- `/institutional`: FPO, insurer, and government reporting views
- `/audit`: full agent audit trail with export support

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

- The backend uses synthetic NDVI plus Open-Meteo weather with retry and fallback behavior.
- Auditability, multilingual advisory generation, and edge-case escalation are first-class demo features.
- The repository is intentionally structured for public GitHub sharing and straightforward deployment.
