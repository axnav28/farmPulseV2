import asyncio
import csv
import hashlib
import json
import math
import os
import random
import sqlite3
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, Literal, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

load_dotenv()

APP_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("FARMPULSE_DB_PATH", "/tmp/farmpulse.db" if os.getenv("VERCEL") else str(APP_DIR / "farmpulse.db")))
UTC = timezone.utc
TODAY = date(2026, 3, 24)

RiskCategory = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
AgentStatus = Literal["IDLE", "RUNNING", "COMPLETE", "ERROR"]

SUPPORTED_LANGUAGES = {
    "Auto",
    "English",
    "Hindi",
    "Marathi",
    "Punjabi",
    "Bengali",
    "Gujarati",
    "Tamil",
    "Telugu",
    "Kannada",
    "Malayalam",
}


class DistrictRecord(BaseModel):
    id: str
    district: str
    state: str
    lat: float
    lon: float
    primary_crop: str
    acreage_lakh: float
    kvk_contact: str
    language: str


class WeatherData(BaseModel):
    rainfall_7d_mm: float
    rainfall_anomaly_pct: float
    avg_temp_c: float
    temp_anomaly_c: float
    humidity_pct: float
    weather_anomaly: str
    source: str
    stale: bool = False


class PestWindow(BaseModel):
    crop: str
    district: str
    month: int
    probability: int
    pest_name: str


class AnalyzeRequest(BaseModel):
    district: str
    crop: str
    language: str = "Hindi"
    farmer_query: str = ""
    phone_type: Literal["smartphone", "feature-phone"] = "smartphone"
    channel: Literal["dashboard", "farmer", "institutional"] = "dashboard"
    run_id: Optional[str] = None
    edge_case: Optional[Literal["unknown_crop", "data_staleness", "multi_stressor_conflict"]] = None


class FarmerQueryRequest(AnalyzeRequest):
    channel: Literal["farmer", "dashboard", "institutional"] = "farmer"


class EdgeCaseRequest(BaseModel):
    scenario: Literal["unknown_crop", "data_staleness", "multi_stressor_conflict"]
    district: str = "Yavatmal"
    crop: str = "Cotton"
    language: str = "Marathi"
    run_id: Optional[str] = None


class FarmPulseState(BaseModel):
    run_id: str
    district: str
    state: str
    crop: str
    language: str
    farmer_query: str
    phone_type: str
    edge_case: Optional[str] = None
    ndvi_score: float = 0.0
    ndvi_baseline: float = 0.0
    ndvi_anomaly_pct: float = 0.0
    weather_data: dict[str, Any] = Field(default_factory=dict)
    crop_stage: str = ""
    pest_risk: str = ""
    pest_probability: int = 0
    days_to_harvest: int = 0
    risk_report: dict[str, Any] = Field(default_factory=dict)
    escalate: bool = False
    escalation_reason: str = ""
    advisory_sms: str = ""
    advisory_whatsapp: str = ""
    advisory_institutional: str = ""
    reasoning_chain: list[dict[str, str]] = Field(default_factory=list)
    audit_log: list[dict[str, Any]] = Field(default_factory=list)
    data_freshness_days: int = 5
    confidence: float = 0.0
    model_used: str = ""
    institutional_outputs: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    satellite_signal: dict[str, Any] = Field(default_factory=dict)
    ndvi_meta: dict[str, Any] = Field(default_factory=dict)
    district_record: dict[str, Any] = Field(default_factory=dict)
    soil_snapshot: dict[str, Any] = Field(default_factory=dict)
    forecast_5d: list[dict[str, Any]] = Field(default_factory=list)
    data_sources: list[str] = Field(default_factory=list)
    phi_compliant: bool = True
    crop_supported: bool = True
    input_source: str = "manual"


class AuditEntry(BaseModel):
    timestamp: str
    run_id: str
    district: str
    state: str
    crop: str
    agent: str
    action: str
    input_summary: str
    output_summary: str
    model_used: str
    tokens_consumed: int
    confidence: float
    escalation: bool
    risk_level: str


app = FastAPI(
    title="FarmPulse Agent Engine",
    description="Agentic crop risk intelligence backend for ET GenAI Hackathon 2026.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


DISTRICT_DATA = [
    DistrictRecord(id="yavatmal", district="Yavatmal", state="Maharashtra", lat=20.3899, lon=78.1307, primary_crop="Cotton", acreage_lakh=4.2, kvk_contact="07232-242216", language="Marathi"),
    DistrictRecord(id="akola", district="Akola", state="Maharashtra", lat=20.7002, lon=77.0082, primary_crop="Cotton", acreage_lakh=3.4, kvk_contact="0724-2258372", language="Marathi"),
    DistrictRecord(id="nashik", district="Nashik", state="Maharashtra", lat=19.9975, lon=73.7898, primary_crop="Soybean", acreage_lakh=2.1, kvk_contact="0253-2305231", language="Marathi"),
    DistrictRecord(id="nagpur", district="Nagpur", state="Maharashtra", lat=21.1458, lon=79.0882, primary_crop="Soybean", acreage_lakh=2.3, kvk_contact="0712-2689485", language="Marathi"),
    DistrictRecord(id="amravati", district="Amravati", state="Maharashtra", lat=20.9374, lon=77.7796, primary_crop="Cotton", acreage_lakh=3.0, kvk_contact="0721-2661835", language="Marathi"),
    DistrictRecord(id="ludhiana", district="Ludhiana", state="Punjab", lat=30.9009, lon=75.8573, primary_crop="Wheat", acreage_lakh=3.6, kvk_contact="0161-2401960", language="Punjabi"),
    DistrictRecord(id="bathinda", district="Bathinda", state="Punjab", lat=30.207, lon=74.9455, primary_crop="Cotton", acreage_lakh=2.4, kvk_contact="0164-2215619", language="Punjabi"),
    DistrictRecord(id="moga", district="Moga", state="Punjab", lat=30.8165, lon=75.1717, primary_crop="Wheat", acreage_lakh=2.1, kvk_contact="01636-233119", language="Punjabi"),
    DistrictRecord(id="patiala", district="Patiala", state="Punjab", lat=30.3398, lon=76.3869, primary_crop="Wheat", acreage_lakh=2.8, kvk_contact="0175-2212974", language="Punjabi"),
    DistrictRecord(id="sangrur", district="Sangrur", state="Punjab", lat=30.2458, lon=75.8421, primary_crop="Rice", acreage_lakh=2.2, kvk_contact="01672-278129", language="Punjabi"),
    DistrictRecord(id="meerut", district="Meerut", state="UP", lat=28.9845, lon=77.7064, primary_crop="Sugarcane", acreage_lakh=3.9, kvk_contact="0121-2880521", language="Hindi"),
    DistrictRecord(id="agra", district="Agra", state="UP", lat=27.1767, lon=78.0081, primary_crop="Wheat", acreage_lakh=2.5, kvk_contact="0562-2960223", language="Hindi"),
    DistrictRecord(id="jhansi", district="Jhansi", state="UP", lat=25.4484, lon=78.5685, primary_crop="Wheat", acreage_lakh=1.9, kvk_contact="0510-2730466", language="Hindi"),
    DistrictRecord(id="varanasi", district="Varanasi", state="UP", lat=25.3176, lon=82.9739, primary_crop="Rice", acreage_lakh=2.0, kvk_contact="0542-2621182", language="Hindi"),
    DistrictRecord(id="bareilly", district="Bareilly", state="UP", lat=28.367, lon=79.4304, primary_crop="Sugarcane", acreage_lakh=2.4, kvk_contact="0581-2520360", language="Hindi"),
    DistrictRecord(id="indore", district="Indore", state="MP", lat=22.7196, lon=75.8577, primary_crop="Soybean", acreage_lakh=3.7, kvk_contact="0731-2470501", language="Hindi"),
    DistrictRecord(id="ujjain", district="Ujjain", state="MP", lat=23.1765, lon=75.7885, primary_crop="Soybean", acreage_lakh=2.6, kvk_contact="0734-2522359", language="Hindi"),
    DistrictRecord(id="sehore", district="Sehore", state="MP", lat=23.2032, lon=77.0851, primary_crop="Soybean", acreage_lakh=2.8, kvk_contact="07562-224561", language="Hindi"),
    DistrictRecord(id="vidisha", district="Vidisha", state="MP", lat=23.5251, lon=77.8081, primary_crop="Wheat", acreage_lakh=2.0, kvk_contact="07592-252145", language="Hindi"),
    DistrictRecord(id="gwalior", district="Gwalior", state="MP", lat=26.2183, lon=78.1828, primary_crop="Wheat", acreage_lakh=1.8, kvk_contact="0751-2467292", language="Hindi"),
    DistrictRecord(id="jaipur", district="Rajasthan", state="Rajasthan", lat=26.9124, lon=75.7873, primary_crop="Mustard", acreage_lakh=2.4, kvk_contact="0141-2552909", language="Hindi"),
    DistrictRecord(id="kota", district="Kota", state="Rajasthan", lat=25.2138, lon=75.8648, primary_crop="Soybean", acreage_lakh=2.3, kvk_contact="0744-2471936", language="Hindi"),
    DistrictRecord(id="sriganganagar", district="Sri Ganganagar", state="Rajasthan", lat=29.9038, lon=73.8772, primary_crop="Cotton", acreage_lakh=2.2, kvk_contact="0154-2470190", language="Hindi"),
    DistrictRecord(id="ajmer", district="Ajmer", state="Rajasthan", lat=26.4499, lon=74.6399, primary_crop="Wheat", acreage_lakh=1.7, kvk_contact="0145-2671800", language="Hindi"),
    DistrictRecord(id="bikaner", district="Bikaner", state="Rajasthan", lat=28.0229, lon=73.3119, primary_crop="Wheat", acreage_lakh=1.9, kvk_contact="0151-2250017", language="Hindi"),
]

SUPPORTED_CROPS = {"Wheat", "Rice", "Cotton", "Soybean", "Sugarcane"}

CROP_TO_MANDI_COMMODITY = {
    "Cotton": "Cotton",
    "Wheat": "Wheat",
    "Rice": "Paddy(Dhan)(Common)",
    "Soybean": "Soyabean",
    "Sugarcane": "Sugarcane",
}

MANDI_MARKET_BY_DISTRICT = {
    "Yavatmal": "Yavatmal",
    "Akola": "Akola",
    "Amravati": "Amravati",
    "Nagpur": "Nagpur",
    "Nashik": "Nasik",
    "Ludhiana": "Ludhiana",
    "Bathinda": "Bathinda",
    "Meerut": "Meerut",
    "Indore": "Indore",
    "Kota": "Kota",
}

MANDI_BENCHMARKS = {
    "Cotton": 6000,
    "Wheat": 2450,
    "Rice": 2300,
    "Soybean": 4550,
    "Sugarcane": 360,
}

MANDI_FALLBACK = {
    ("Yavatmal", "Cotton"): {"market": "Yavatmal", "modalPrice": 6200, "minPrice": 6025, "maxPrice": 6380, "priceDate": "2026-03-26"},
    ("Akola", "Cotton"): {"market": "Akola", "modalPrice": 6080, "minPrice": 5920, "maxPrice": 6250, "priceDate": "2026-03-26"},
    ("Amravati", "Cotton"): {"market": "Amravati", "modalPrice": 6150, "minPrice": 5980, "maxPrice": 6310, "priceDate": "2026-03-26"},
    ("Ludhiana", "Wheat"): {"market": "Ludhiana", "modalPrice": 2525, "minPrice": 2450, "maxPrice": 2590, "priceDate": "2026-03-26"},
    ("Meerut", "Sugarcane"): {"market": "Meerut", "modalPrice": 365, "minPrice": 355, "maxPrice": 372, "priceDate": "2026-03-26"},
    ("Indore", "Soybean"): {"market": "Indore", "modalPrice": 4680, "minPrice": 4520, "maxPrice": 4780, "priceDate": "2026-03-26"},
    ("Kota", "Soybean"): {"market": "Kota", "modalPrice": 4620, "minPrice": 4490, "maxPrice": 4740, "priceDate": "2026-03-26"},
}

AGMARKNET_CATALOG_URL = "https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi"
DEFAULT_AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"

CROP_CALENDAR: dict[str, dict[str, dict[str, Any]]] = {
    "Maharashtra": {
        "Cotton": {"stage_by_month": {3: "Flowering", 4: "Flowering", 5: "Boll Development", 10: "Flowering"}, "days_to_harvest": 45},
        "Soybean": {"stage_by_month": {3: "Harvest", 4: "Harvest", 9: "Flowering"}, "days_to_harvest": 30},
        "Sugarcane": {"stage_by_month": {3: "Grand Growth", 4: "Grand Growth"}, "days_to_harvest": 120},
    },
    "Punjab": {
        "Wheat": {"stage_by_month": {3: "Grain Filling", 4: "Harvest"}, "days_to_harvest": 25},
        "Rice": {"stage_by_month": {3: "Nursery Planning", 10: "Harvest"}, "days_to_harvest": 150},
        "Cotton": {"stage_by_month": {3: "Vegetative", 10: "Flowering"}, "days_to_harvest": 60},
    },
    "UP": {
        "Wheat": {"stage_by_month": {3: "Grain Filling", 4: "Harvest"}, "days_to_harvest": 28},
        "Rice": {"stage_by_month": {3: "Fallow", 10: "Harvest"}, "days_to_harvest": 160},
        "Sugarcane": {"stage_by_month": {3: "Tillering", 4: "Tillering"}, "days_to_harvest": 110},
    },
    "MP": {
        "Soybean": {"stage_by_month": {3: "Post-Harvest Planning", 9: "Flowering"}, "days_to_harvest": 120},
        "Wheat": {"stage_by_month": {3: "Grain Filling", 4: "Harvest"}, "days_to_harvest": 30},
    },
    "Rajasthan": {
        "Wheat": {"stage_by_month": {3: "Grain Filling", 4: "Harvest"}, "days_to_harvest": 32},
        "Soybean": {"stage_by_month": {3: "Off-Season", 9: "Flowering"}, "days_to_harvest": 140},
        "Cotton": {"stage_by_month": {3: "Vegetative", 10: "Flowering"}, "days_to_harvest": 80},
    },
}

PEST_WINDOWS = [
    PestWindow(crop="Cotton", district="Yavatmal", month=3, probability=72, pest_name="Pink bollworm"),
    PestWindow(crop="Cotton", district="Akola", month=3, probability=66, pest_name="Pink bollworm"),
    PestWindow(crop="Cotton", district="Bathinda", month=3, probability=62, pest_name="Whitefly"),
    PestWindow(crop="Soybean", district="Indore", month=3, probability=54, pest_name="Stem fly"),
    PestWindow(crop="Wheat", district="Ludhiana", month=3, probability=38, pest_name="Aphid"),
    PestWindow(crop="Sugarcane", district="Meerut", month=3, probability=42, pest_name="Early shoot borer"),
]

HISTORICAL_BASELINES = {
    "Wheat": [0.61, 0.64, 0.63, 0.65, 0.66],
    "Rice": [0.68, 0.7, 0.72, 0.69, 0.71],
    "Cotton": [0.66, 0.69, 0.67, 0.68, 0.7],
    "Soybean": [0.63, 0.65, 0.66, 0.64, 0.67],
    "Sugarcane": [0.71, 0.74, 0.73, 0.75, 0.76],
}

LAST_KNOWN_WEATHER: dict[str, WeatherData] = {}
RUN_QUEUES: dict[str, asyncio.Queue[str]] = {}


def seed_for(*parts: str) -> int:
    joined = "|".join(parts)
    return int(hashlib.sha256(joined.encode("utf-8")).hexdigest()[:12], 16)


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def normalize_language(language: str | None, district_language: str = "Hindi") -> str:
    aliases = {
        "auto": "Auto",
        "english": "English",
        "hindi": "Hindi",
        "marathi": "Marathi",
        "punjabi": "Punjabi",
        "bengali": "Bengali",
        "gujarati": "Gujarati",
        "tamil": "Tamil",
        "telugu": "Telugu",
        "kannada": "Kannada",
        "malayalam": "Malayalam",
    }
    cleaned = (language or "").strip().lower()
    if not cleaned:
        return district_language
    return aliases.get(cleaned, district_language)


def detect_language_from_text(text: str, district_language: str = "Hindi") -> str:
    if not text.strip():
        return district_language
    for char in text:
        code = ord(char)
        if 0x0A00 <= code <= 0x0A7F:
            return "Punjabi"
        if 0x0980 <= code <= 0x09FF:
            return "Bengali"
        if 0x0A80 <= code <= 0x0AFF:
            return "Gujarati"
        if 0x0B80 <= code <= 0x0BFF:
            return "Tamil"
        if 0x0C00 <= code <= 0x0C7F:
            return "Telugu"
        if 0x0C80 <= code <= 0x0CFF:
            return "Kannada"
        if 0x0D00 <= code <= 0x0D7F:
            return "Malayalam"
        if 0x0900 <= code <= 0x097F:
            return district_language if district_language in {"Hindi", "Marathi"} else "Hindi"
    if any("a" <= ch.lower() <= "z" for ch in text):
        return "English"
    return district_language


def whisper_language_name(code: str, district_language: str = "Hindi") -> str:
    mapping = {
        "mr": "Marathi",
        "hi": "Hindi",
        "pa": "Punjabi",
        "en": "English",
        "bn": "Bengali",
        "gu": "Gujarati",
        "ta": "Tamil",
        "te": "Telugu",
        "kn": "Kannada",
        "ml": "Malayalam",
    }
    return mapping.get((code or "").split("-")[0], district_language)


def language_code(language: str) -> str | None:
    return {
        "Marathi": "mr",
        "Hindi": "hi",
        "Punjabi": "pa",
        "English": "en",
        "Bengali": "bn",
        "Gujarati": "gu",
        "Tamil": "ta",
        "Telugu": "te",
        "Kannada": "kn",
        "Malayalam": "ml",
        "Auto": None,
    }.get(language, "en")


def resolve_language(language: str, query: str, district_language: str) -> str:
    normalized = normalize_language(language, district_language)
    if normalized == "Auto":
        return detect_language_from_text(query, district_language)
    return normalized


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                run_id TEXT NOT NULL,
                district TEXT NOT NULL,
                state TEXT NOT NULL,
                crop TEXT NOT NULL,
                agent TEXT NOT NULL,
                action TEXT NOT NULL,
                input_summary TEXT NOT NULL,
                output_summary TEXT NOT NULL,
                model_used TEXT NOT NULL,
                tokens_consumed INTEGER NOT NULL,
                confidence REAL NOT NULL,
                escalation INTEGER NOT NULL,
                risk_level TEXT NOT NULL
            )
            """
        )


@app.on_event("startup")
async def startup_event() -> None:
    init_db()


def get_district_record(district_name: str) -> DistrictRecord:
    for record in DISTRICT_DATA:
        if record.district.lower() == district_name.lower() or record.id == district_name.lower():
            return record
    raise HTTPException(status_code=404, detail=f"Unknown district: {district_name}")


def select_model(task_type: str, complexity: str) -> str:
    if task_type == "sms_advisory" or complexity == "low":
        return "farmer-advisory-engine"
    if task_type == "institutional_report" or complexity == "high":
        return "institutional-analysis-engine"
    return "farmer-advisory-engine"


async def emit_event(run_id: str, agent: str, step: str, status: str, message: str, confidence: float | None = None) -> None:
    queue = RUN_QUEUES.setdefault(run_id, asyncio.Queue())
    event = {
        "agent": agent,
        "step": step,
        "status": status,
        "message": message,
        "timestamp": now_iso(),
        "run_id": run_id,
        "confidence": confidence,
    }
    await queue.put(f"data: {json.dumps(event)}\n\n")


def persist_audit_entry(entry: AuditEntry) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO audit_log (
                timestamp, run_id, district, state, crop, agent, action,
                input_summary, output_summary, model_used, tokens_consumed,
                confidence, escalation, risk_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry.timestamp,
                entry.run_id,
                entry.district,
                entry.state,
                entry.crop,
                entry.agent,
                entry.action,
                entry.input_summary,
                entry.output_summary,
                entry.model_used,
                entry.tokens_consumed,
                entry.confidence,
                1 if entry.escalation else 0,
                entry.risk_level,
            ),
        )


def add_audit_entry(
    state: FarmPulseState,
    agent: str,
    action: str,
    input_summary: str,
    output_summary: str,
    model_used: str,
    tokens_consumed: int,
    confidence: float,
    risk_level: str,
) -> None:
    entry = AuditEntry(
        timestamp=now_iso(),
        run_id=state.run_id,
        district=state.district,
        state=state.state,
        crop=state.crop,
        agent=agent,
        action=action,
        input_summary=input_summary,
        output_summary=output_summary,
        model_used=model_used,
        tokens_consumed=tokens_consumed,
        confidence=round(confidence, 1),
        escalation=state.escalate,
        risk_level=risk_level,
    )
    persist_audit_entry(entry)
    state.audit_log.append(entry.model_dump())


def crop_calendar(record: DistrictRecord, crop: str) -> tuple[str, int]:
    state_calendar = CROP_CALENDAR.get(record.state, {})
    crop_data = state_calendar.get(crop) or next(iter(state_calendar.values()), {"stage_by_month": {}, "days_to_harvest": 90})
    return crop_data["stage_by_month"].get(TODAY.month, "Vegetative"), int(crop_data["days_to_harvest"])


def get_pest_probability(district: str, crop: str) -> tuple[int, str]:
    for window in PEST_WINDOWS:
        if window.district == district and window.crop == crop and window.month == TODAY.month:
            return window.probability, window.pest_name
    return (28 if crop in SUPPORTED_CROPS else 0), "General field stress"


def seasonal_baseline(crop: str) -> float:
    baseline = HISTORICAL_BASELINES.get(crop, [0.6, 0.62, 0.61, 0.63, 0.64])
    return round(sum(baseline) / len(baseline), 2)


def build_soil_snapshot(record: DistrictRecord, crop: str, weather: WeatherData, ndvi_score: float) -> dict[str, Any]:
    rng = random.Random(seed_for(record.district, crop, "soil"))
    moisture = max(18, min(72, round(58 + (weather.rainfall_7d_mm - 50) * 0.12 + (ndvi_score - 0.55) * 40 + rng.uniform(-4, 4), 1)))
    ec = round(max(0.18, min(1.1, 0.42 + rng.uniform(-0.08, 0.18))), 2)
    nitrogen = max(120, min(420, int(245 + (ndvi_score - 0.55) * 180 + rng.uniform(-35, 35))))
    ph = round(max(5.8, min(7.9, 6.8 + rng.uniform(-0.4, 0.5))), 1)
    moisture_band = "Adequate"
    if moisture < 32:
        moisture_band = "Low"
    elif moisture > 62:
        moisture_band = "High"
    return {
        "moisturePct": moisture,
        "moistureBand": moisture_band,
        "soilPH": ph,
        "nitrogenKgHa": nitrogen,
        "electricalConductivity": ec,
        "summary": f"Soil moisture {moisture_band.lower()} with pH {ph} and available nitrogen {nitrogen} kg/ha",
    }


def build_forecast_5d(record: DistrictRecord, weather: WeatherData) -> list[dict[str, Any]]:
    rng = random.Random(seed_for(record.district, "forecast", str(TODAY)))
    base_temp = weather.avg_temp_c
    base_rain = max(0.0, weather.rainfall_7d_mm / 5)
    forecast = []
    for index in range(5):
        rain = round(max(0.0, base_rain + rng.uniform(-6, 9)), 1)
        max_temp = round(base_temp + rng.uniform(-2.2, 2.6), 1)
        min_temp = round(max_temp - rng.uniform(6.5, 9.5), 1)
        humidity = round(max(35, min(92, weather.humidity_pct + rng.uniform(-8, 7))), 1)
        outlook = "Dry window"
        if rain >= 12:
            outlook = "Rain likely"
        elif humidity >= 75:
            outlook = "Humid"
        forecast.append({
            "day": (TODAY + timedelta(days=index + 1)).strftime("%a"),
            "date": (TODAY + timedelta(days=index + 1)).isoformat(),
            "rainMm": rain,
            "maxTempC": max_temp,
            "minTempC": min_temp,
            "humidityPct": humidity,
            "outlook": outlook,
        })
    return forecast


def synthetic_ndvi(record: DistrictRecord, crop: str, freshness_days: int, forced_stress: bool) -> float:
    rng = random.Random(seed_for(record.district, crop, str(TODAY)))
    baseline = seasonal_baseline(crop)
    seasonal_wave = 0.04 * math.sin((TODAY.timetuple().tm_yday / 365) * 2 * math.pi)
    noise = rng.uniform(-0.04, 0.04)
    stressed = forced_stress or record.district in {"Yavatmal", "Akola", "Bathinda", "Sri Ganganagar"}
    depression = rng.uniform(0.15, 0.25) if stressed else rng.uniform(-0.03, 0.03)
    value = baseline + seasonal_wave + noise - depression
    if record.district == "Yavatmal" and crop == "Cotton":
        value = 0.52
    if freshness_days > 10:
        value = min(value + 0.02, baseline)
    return round(max(0.22, min(0.88, value)), 2)


def ndvi_reference_meta(record: DistrictRecord, crop: str, freshness_days: int, ndvi_score: float, baseline: float) -> dict[str, Any]:
    observed_at = (TODAY - timedelta(days=freshness_days)).isoformat()
    return {
        "mode": "demo_estimate",
        "observedAt": observed_at,
        "freshnessDays": freshness_days,
        "sourceName": "NASA Earthdata MODIS MOD13Q1 V061",
        "sourceUrl": "https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061",
        "resolution": "250 m, 16-day composite",
        "citation": "Didan, K. (2021). MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061. NASA LP DAAC. doi:10.5067/MODIS/MOD13Q1.061",
        "note": f"Displayed district NDVI is a demo estimate aligned to MODIS NDVI ranges for {record.district} {crop.lower()} conditions, not a live pixel extraction.",
        "displayLabel": "Demo-estimated NDVI aligned to NASA MODIS reference ranges",
        "scoreRange": f"Observed {ndvi_score:.2f} vs baseline {baseline:.2f}",
    }



def normalized_record_lookup(record: dict[str, Any]) -> dict[str, Any]:
    return {str(key).lower().replace('_', '').replace(' ', '').replace('-', ''): value for key, value in record.items()}


def pick_record_value(record: dict[str, Any], *candidates: str) -> Any:
    normalized = normalized_record_lookup(record)
    for candidate in candidates:
        key = candidate.lower().replace('_', '').replace(' ', '').replace('-', '')
        if key in normalized and normalized[key] not in (None, ''):
            return normalized[key]
    return None


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(str(value).replace(',', '').strip())
    except Exception:
        return default


def to_int(value: Any, default: int = 0) -> int:
    try:
        return int(round(float(str(value).replace(',', '').strip())))
    except Exception:
        return default


def mandi_recommendation(crop: str, modal_price: int, benchmark_price: int) -> tuple[str, str, str]:
    if modal_price >= benchmark_price * 1.04:
        return (
            "Strong mandi realization against the working benchmark. Consider staggered selling now instead of waiting for a sharp jump.",
            "Sell in tranches",
            "Above benchmark",
        )
    if modal_price <= benchmark_price * 0.97:
        return (
            "Current mandi realization is softer than the working benchmark. Hold if storage and cash flow permit, otherwise sell only part of the lot.",
            "Hold or part-sell",
            "Below benchmark",
        )
    return (
        "Current mandi realization is near the working benchmark. Sell only planned volume and review again after the next market update.",
        "Neutral hold",
        "Near benchmark",
    )


async def fetch_mandi_price(record: DistrictRecord, crop: str) -> dict[str, Any]:
    commodity = CROP_TO_MANDI_COMMODITY.get(crop, crop)
    market_name = MANDI_MARKET_BY_DISTRICT.get(record.district, record.district)
    benchmark = MANDI_BENCHMARKS.get(crop, 1000)
    api_key = os.getenv('AGMARKNET_API_KEY')
    resource_id = os.getenv('AGMARKNET_RESOURCE_ID', DEFAULT_AGMARKNET_RESOURCE_ID)

    if api_key:
        try:
            params = {
                'api-key': api_key,
                'format': 'json',
                'limit': 25,
                'offset': 0,
                'filters[state]': record.state,
                'filters[district]': record.district,
                'filters[commodity]': commodity,
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f'https://api.data.gov.in/resource/{resource_id}', params=params)
                response.raise_for_status()
                payload = response.json()
            records = payload.get('records') or payload.get('results') or []
            chosen: dict[str, Any] | None = None
            for item in records:
                market_value = str(pick_record_value(item, 'market', 'market_name') or '').lower()
                if market_name.lower() in market_value:
                    chosen = item
                    break
            if chosen is None and records:
                chosen = records[0]
            if chosen:
                modal_price = to_int(pick_record_value(chosen, 'modal_price', 'modalprice', 'model_price'))
                min_price = to_int(pick_record_value(chosen, 'min_price', 'minprice'))
                max_price = to_int(pick_record_value(chosen, 'max_price', 'maxprice'))
                price_date = str(pick_record_value(chosen, 'arrival_date', 'pricedate', 'price_date') or TODAY.isoformat())
                market = str(pick_record_value(chosen, 'market', 'market_name') or market_name)
                if modal_price > 0:
                    recommendation, recommendation_short, trend = mandi_recommendation(crop, modal_price, benchmark)
                    return {
                        'district': record.district,
                        'state': record.state,
                        'crop': crop,
                        'commodity': commodity,
                        'market': market,
                        'priceDate': price_date,
                        'modalPrice': modal_price,
                        'minPrice': min_price or modal_price,
                        'maxPrice': max_price or modal_price,
                        'benchmarkPrice': benchmark,
                        'currency': 'INR',
                        'unit': 'quintal',
                        'trend': trend,
                        'recommendation': recommendation,
                        'recommendationShort': recommendation_short,
                        'sourceName': 'data.gov.in Agmarknet API',
                        'sourceUrl': AGMARKNET_CATALOG_URL,
                        'live': True,
                        'note': 'Live mandi price fetched from the official Agmarknet catalog on data.gov.in.',
                    }
        except Exception:
            pass

    fallback = MANDI_FALLBACK.get((record.district, crop))
    if fallback is None:
        rng = random.Random(seed_for(record.district, crop, 'mandi'))
        modal_price = int(round(benchmark * (0.97 + rng.uniform(-0.03, 0.08))))
        spread = max(10, int(modal_price * 0.025))
        fallback = {
            'market': market_name,
            'modalPrice': modal_price,
            'minPrice': modal_price - spread,
            'maxPrice': modal_price + spread,
            'priceDate': TODAY.isoformat(),
        }

    recommendation, recommendation_short, trend = mandi_recommendation(crop, fallback['modalPrice'], benchmark)
    live_note = 'Live Agmarknet pricing is enabled when AGMARKNET_API_KEY is configured on the API host.'
    return {
        'district': record.district,
        'state': record.state,
        'crop': crop,
        'commodity': commodity,
        'market': fallback['market'],
        'priceDate': fallback['priceDate'],
        'modalPrice': fallback['modalPrice'],
        'minPrice': fallback['minPrice'],
        'maxPrice': fallback['maxPrice'],
        'benchmarkPrice': benchmark,
        'currency': 'INR',
        'unit': 'quintal',
        'trend': trend,
        'recommendation': recommendation,
        'recommendationShort': recommendation_short,
        'sourceName': 'Agmarknet-aligned fallback sample',
        'sourceUrl': AGMARKNET_CATALOG_URL,
        'live': False,
        'note': 'Using a demo fallback because live Agmarknet API credentials or matching district records are not available in this environment. ' + live_note,
    }


async def fetch_weather(record: DistrictRecord) -> WeatherData:
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={record.lat}&longitude={record.lon}"
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum"
        "&hourly=relative_humidity_2m"
        "&forecast_days=7"
        "&timezone=auto"
    )
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                payload = response.json()
            rainfall = round(sum(payload.get("daily", {}).get("precipitation_sum", [])[:7]), 1)
            max_temps = payload.get("daily", {}).get("temperature_2m_max", [])
            min_temps = payload.get("daily", {}).get("temperature_2m_min", [])
            humidity = payload.get("hourly", {}).get("relative_humidity_2m", [])[:24]
            avg_temp = round(sum(max_temps[:7] + min_temps[:7]) / max(1, len(max_temps[:7] + min_temps[:7])), 1)
            humidity_avg = round(sum(humidity) / max(1, len(humidity)), 1)
            anomaly_pct = round(((rainfall - 50) / 50) * 100, 1)
            temp_anomaly = round(avg_temp - 29.0, 1)
            weather_anomaly = "normal"
            if rainfall > 200:
                weather_anomaly = "flood"
            elif rainfall < 15:
                weather_anomaly = "drought"
            elif temp_anomaly > 4:
                weather_anomaly = "heat"
            elif temp_anomaly < -4:
                weather_anomaly = "cold"
            weather = WeatherData(
                rainfall_7d_mm=rainfall,
                rainfall_anomaly_pct=anomaly_pct,
                avg_temp_c=avg_temp,
                temp_anomaly_c=temp_anomaly,
                humidity_pct=humidity_avg,
                weather_anomaly=weather_anomaly,
                source="open-meteo",
            )
            LAST_KNOWN_WEATHER[record.district] = weather
            return weather
        except Exception:
            if attempt < 2:
                await asyncio.sleep(0.35 * (2**attempt))

    fallback = LAST_KNOWN_WEATHER.get(record.district)
    if fallback:
        return fallback.model_copy(update={"source": "last-known-good", "stale": True})
    rng = random.Random(seed_for(record.district, "weather"))
    rainfall = round(rng.uniform(20, 90), 1)
    anomaly = "normal" if 20 <= rainfall <= 120 else "drought"
    generated = WeatherData(
        rainfall_7d_mm=rainfall,
        rainfall_anomaly_pct=round(((rainfall - 50) / 50) * 100, 1),
        avg_temp_c=round(rng.uniform(26, 34), 1),
        temp_anomaly_c=round(rng.uniform(-2, 4), 1),
        humidity_pct=round(rng.uniform(48, 82), 1),
        weather_anomaly=anomaly,
        source="synthetic-fallback",
        stale=True,
    )
    LAST_KNOWN_WEATHER[record.district] = generated
    return generated


def summarize_root_cause(weather: WeatherData, pest_probability: int, crop: str, district: str) -> str:
    if district == "Yavatmal" and crop == "Cotton":
        return "Probable pink bollworm stress or nitrogen deficiency - ground validation required"
    if weather.weather_anomaly == "flood":
        return "Excess rainfall and flood stress likely suppressing canopy vigor"
    if weather.weather_anomaly == "drought":
        return "Soil moisture deficit consistent with drought stress"
    if pest_probability >= 60:
        return "Likely pest or disease pressure due to seasonal outbreak window"
    return "Mixed agronomic stress; monitor and verify at field level"


def map_risk_category(score: float) -> RiskCategory:
    if score >= 85:
        return "CRITICAL"
    if score >= 70:
        return "HIGH"
    if score >= 45:
        return "MEDIUM"
    return "LOW"


def detect_query_signals(query: str) -> dict[str, bool]:
    normalized = query.lower()
    return {
        "asks_fertilizer_timing": any(token in normalized for token in ["fertilizer", "fertiliser", "खत", "खाद", "उर्वरक", "नत्र", "top dress", "topdress"]),
        "mentions_yellowing": any(token in normalized for token in ["yellow", "yellowing", "पीला", "पीली", "पिवळ", "yellow spots", "डाग"]),
        "mentions_spots": any(token in normalized for token in ["spots", "spot", "डाग", "धब्ब", "दाग"]),
        "mentions_pest": any(token in normalized for token in ["worm", "pest", "bollworm", "अळी", "कीट", "sucking pest"]),
    }


def choose_application_window(forecast_5d: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not forecast_5d:
        return None
    ranked = sorted(
        forecast_5d,
        key=lambda day: (day["rainMm"], day["humidityPct"], day["maxTempC"]),
    )
    return ranked[0]


def format_window_label(day: dict[str, Any] | None) -> str:
    if not day:
        return "next dry window"
    return f"{day['day']} {datetime.fromisoformat(day['date']).strftime('%d %b')}"


def localize_pest_name(pest_name: str, language: str) -> str:
    mapping = {
        "Pink bollworm": {
            "English": "pink bollworm",
            "Hindi": "गुलाबी सुंडी",
            "Marathi": "गुलाबी बोंड अळी",
        },
        "Whitefly": {
            "English": "whitefly",
            "Hindi": "सफेद मक्खी",
            "Marathi": "पांढरी माशी",
        },
        "Stem fly": {
            "English": "stem fly",
            "Hindi": "स्टेम फ्लाई",
            "Marathi": "स्टेम फ्लाय",
        },
        "Aphid": {
            "English": "aphid",
            "Hindi": "एफिड",
            "Marathi": "अळीमाशी",
        },
        "Early shoot borer": {
            "English": "early shoot borer",
            "Hindi": "शूट बोरर",
            "Marathi": "शूट बोरर",
        },
    }
    localized = mapping.get(pest_name, {})
    return localized.get(language, localized.get("English", pest_name.lower()))


def build_query_aware_plan(state: FarmPulseState) -> dict[str, Any]:
    signals = detect_query_signals(state.farmer_query)
    soil = state.soil_snapshot
    best_day = choose_application_window(state.forecast_5d)
    window_label = format_window_label(best_day)
    pest_label = localize_pest_name(state.pest_risk, state.language)
    rain_mm = best_day["rainMm"] if best_day else 0.0
    is_wet_window = bool(best_day and best_day["rainMm"] > 8)

    if is_wet_window:
        timing = f"Wait for a drier window around {window_label}; avoid fertilizer before {rain_mm:.0f} mm rain."
    elif soil["moistureBand"] == "High":
        timing = f"Wait until {window_label}; the field is already wet, so top-dressing now may be lost."
    elif soil["moistureBand"] == "Low":
        timing = f"Apply only a light split nitrogen dose around {window_label} and, if possible, give light irrigation afterwards."
    else:
        timing = f"Apply only a split nitrogen dose around {window_label} when leaves are dry."

    if state.pest_probability >= 60:
        field_check = f"Before fertilizer, inspect 10 plants for fresh {pest_label} damage."
    elif signals["mentions_yellowing"]:
        field_check = "Check whether yellowing is mainly on older leaves; that usually supports nitrogen deficiency."
    else:
        field_check = "Check 10 representative plants before applying any corrective input."

    if signals["mentions_yellowing"] and state.pest_probability >= 60:
        primary_concern = f"Yellowing may be due to {pest_label} pressure or nitrogen deficiency."
    elif signals["mentions_yellowing"]:
        primary_concern = "Leaf yellowing is more consistent with nutrient stress than water stress."
    else:
        primary_concern = state.risk_report["rootCause"]

    if soil["nitrogenKgHa"] < 230 or signals["mentions_yellowing"]:
        nutrient_step = "If no fresh pest damage is seen, use a split nitrogen top-dress rather than one heavy dose."
    else:
        nutrient_step = "Keep nutrition balanced and avoid excess fertilizer in one go."

    if signals["asks_fertilizer_timing"]:
        recommendation = f"{field_check} {timing} {nutrient_step}"
    else:
        recommendation = f"{field_check} {nutrient_step} {timing}"

    return {
        "signals": signals,
        "window_label": window_label,
        "primary_concern": primary_concern,
        "timing": timing,
        "field_check": field_check,
        "nutrient_step": nutrient_step,
        "recommended_action": recommendation,
        "pest_label": pest_label,
        "rain_mm": rain_mm,
    }


def localize_plan_text(state: FarmPulseState, plan: dict[str, Any]) -> dict[str, str]:
    soil = state.soil_snapshot
    signals = plan["signals"]
    rain_mm = plan["rain_mm"]
    window_label = plan["window_label"]
    pest_label = plan["pest_label"]

    if state.language == "Hindi":
        if signals["mentions_yellowing"] and state.pest_probability >= 60:
            primary = f"पत्तियों का पीलापन {pest_label} या नत्र की कमी से जुड़ा हो सकता है।"
        elif signals["mentions_yellowing"]:
            primary = "पत्तियों का पीलापन पोषण की कमी से अधिक मेल खाता है।"
        else:
            primary = state.risk_report["rootCause"]

        if state.pest_probability >= 60:
            field_check = f"खाद देने से पहले 10 पौधों में ताजा {pest_label} नुकसान देखें।"
        elif signals["mentions_yellowing"]:
            field_check = "देखें कि पीलापन पुरानी पत्तियों पर ज्यादा है या नहीं; यह नत्र कमी का संकेत हो सकता है।"
        else:
            field_check = "किसी भी सुधारात्मक इनपुट से पहले 10 प्रतिनिधि पौधों की जांच करें।"

        if rain_mm > 8:
            timing = f"{window_label} के आसपास सूखे समय का इंतजार करें; {rain_mm:.0f} मिमी बारिश से पहले खाद न डालें।"
        elif soil["moistureBand"] == "High":
            timing = f"{window_label} तक प्रतीक्षा करें; खेत अभी गीला है, इसलिए अभी टॉप ड्रेसिंग न करें।"
        elif soil["moistureBand"] == "Low":
            timing = f"{window_label} के आसपास नत्र की हल्की विभाजित मात्रा दें और संभव हो तो हल्की सिंचाई करें।"
        else:
            timing = f"{window_label} के आसपास पत्तियां सूखी होने पर नत्र की विभाजित मात्रा दें।"

        nutrient = "यदि ताजा कीट नुकसान न दिखे तो एक भारी खुराक के बजाय नत्र दो हिस्सों में दें।" if soil["nitrogenKgHa"] < 230 or signals["mentions_yellowing"] else "खाद संतुलित रखें; एक बार में ज्यादा मात्रा न दें।"
        return {"primary": primary, "field_check": field_check, "timing": timing, "nutrient": nutrient}

    if state.language == "Marathi":
        if signals["mentions_yellowing"] and state.pest_probability >= 60:
            primary = f"पिवळेपणा {pest_label} किंवा नत्र कमतरतेमुळे असू शकतो."
        elif signals["mentions_yellowing"]:
            primary = "पिवळेपणा पोषण कमतरतेशी अधिक जुळतो."
        else:
            primary = state.risk_report["rootCause"]

        if state.pest_probability >= 60:
            field_check = f"खत देण्यापूर्वी 10 झाडांवर ताजी {pest_label} हानी तपासा."
        elif signals["mentions_yellowing"]:
            field_check = "पिवळेपणा जुन्या पानांवर जास्त आहे का ते पाहा; हे नत्र कमतरतेचे लक्षण असू शकते."
        else:
            field_check = "कोणतेही सुधारात्मक इनपुट देण्यापूर्वी 10 प्रतिनिधी झाडे तपासा."

        if rain_mm > 8:
            timing = f"{window_label} च्या आसपास कोरड्या वेळेची वाट पाहा; {rain_mm:.0f} मिमी पावसापूर्वी खत टाकू नका."
        elif soil["moistureBand"] == "High":
            timing = f"{window_label} पर्यंत थांबा; शेत आधीच ओलसर आहे, त्यामुळे आत्ताच टॉप ड्रेसिंग करू नका."
        elif soil["moistureBand"] == "Low":
            timing = f"{window_label} च्या आसपास नत्राची हलकी विभागलेली मात्रा द्या आणि शक्य असल्यास हलके पाणी द्या."
        else:
            timing = f"{window_label} च्या आसपास पाने कोरडी असताना नत्राची विभागलेली मात्रा द्या."

        nutrient = "ताजी किडीची हानी दिसत नसेल तर एकदम जड मात्रा देऊ नका; नत्र दोन भागांत द्या." if soil["nitrogenKgHa"] < 230 or signals["mentions_yellowing"] else "अन्नद्रव्ये संतुलित ठेवा; एकाच वेळी जास्त खत देऊ नका."
        return {"primary": primary, "field_check": field_check, "timing": timing, "nutrient": nutrient}

    return {
        "primary": plan["primary_concern"],
        "field_check": plan["field_check"],
        "timing": plan["timing"],
        "nutrient": plan["nutrient_step"],
    }


def render_sms(state: FarmPulseState, kvk_contact: str) -> str:
    if not state.crop_supported:
        messages = {
            "Hindi": "इस फसल के लिए पर्याप्त डेटा उपलब्ध नहीं है। कृपया KVK से संपर्क करें।",
            "Marathi": "या पिकासाठी पुरेसा डेटा उपलब्ध नाही. कृपया KVK शी संपर्क करा.",
            "Punjabi": "ਇਸ ਫਸਲ ਲਈ ਪ੍ਰਯਾਪਤ ਡਾਟਾ ਉਪਲਬਧ ਨਹੀਂ। ਕਿਰਪਾ ਕਰਕੇ KVK ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
            "English": "Not enough data is available for this crop. Please contact your KVK.",
        }
        return messages.get(state.language, messages["English"])

    if state.escalate and state.confidence < 60:
        messages = {
            "Hindi": "विश्वास स्तर कम है। खेत सत्यापन के लिए KVK से संपर्क करें।",
            "Marathi": "विश्वास पातळी कमी आहे. शेत तपासणीसाठी KVK शी संपर्क करा.",
            "Punjabi": "ਭਰੋਸਾ ਘੱਟ ਹੈ। ਮੈਦਾਨੀ ਜਾਂਚ ਲਈ KVK ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
            "English": "Confidence is low. Please contact your KVK for field verification.",
        }
        return messages.get(state.language, messages["English"])

    plan = build_query_aware_plan(state)
    if state.language == "Hindi":
        message = (
            f"{state.district}: पहले {plan['pest_label']} की जांच करें. ताजा नुकसान न हो तो {plan['window_label']} पर नत्र की विभाजित मात्रा दें. KVK {kvk_contact}"
        )
    elif state.language == "Marathi":
        message = (
            f"{state.district}: आधी {plan['pest_label']} तपासा. ताजे नुकसान नसेल तर {plan['window_label']} ला नत्राची विभागलेली मात्रा द्या. KVK {kvk_contact}"
        )
    elif state.language == "Punjabi":
        message = (
            f"{state.district}: ਪਹਿਲਾਂ ਕੀੜੇ ਦੀ ਜਾਂਚ ਕਰੋ. ਨਵਾਂ ਨੁਕਸਾਨ ਨਾ ਹੋਵੇ ਤਾਂ {plan['window_label']} 'ਤੇ ਖਾਦ ਦੀ ਵੰਡਿਆ ਖੁਰਾਕ ਦਿਓ. KVK {kvk_contact}"
        )
    else:
        message = (
            f"{state.district}: Check {plan['pest_label']} first. If no fresh damage, apply split nitrogen on {plan['window_label']}. KVK {kvk_contact}"
        )
    return message[:160]


def render_whatsapp(state: FarmPulseState, kvk_contact: str) -> str:
    if not state.crop_supported:
        return render_sms(state, kvk_contact)

    if state.escalate and state.confidence < 60:
        messages = {
            "Hindi": f"⚠️ विश्वास कम है.\n1. खेत का निरीक्षण करें.\n2. नमूना KVK को दिखाएं.\n3. KVK: {kvk_contact}",
            "Marathi": f"⚠️ खात्री कमी आहे.\n1. शेताची प्रत्यक्ष पाहणी करा.\n2. नमुना KVK ला दाखवा.\n3. KVK: {kvk_contact}",
            "Punjabi": f"⚠️ ਭਰੋਸਾ ਘੱਟ ਹੈ.\n1. ਖੇਤ ਦੀ ਜਾਂਚ ਕਰੋ.\n2. ਨਮੂਨਾ KVK ਨੂੰ ਵਿਖਾਓ.\n3. KVK: {kvk_contact}",
            "English": f"⚠️ Confidence is low.\n1. Inspect the field.\n2. Share samples with KVK.\n3. KVK: {kvk_contact}",
        }
        return messages.get(state.language, messages["English"])[:400]

    plan = build_query_aware_plan(state)
    localized = localize_plan_text(state, plan)
    if state.language == "Hindi":
        message = (
            f"⚠️ {state.district} | {state.crop}\n"
            f"1. {localized['primary']}\n"
            f"2. {localized['field_check']}\n"
            f"3. {localized['timing']} {localized['nutrient']} KVK: {kvk_contact}"
        )
    elif state.language == "Marathi":
        message = (
            f"⚠️ {state.district} | {state.crop}\n"
            f"1. {localized['primary']}\n"
            f"2. {localized['field_check']}\n"
            f"3. {localized['timing']} {localized['nutrient']} KVK: {kvk_contact}"
        )
    elif state.language == "Punjabi":
        message = (
            f"⚠️ {state.district} | {state.crop}\n"
            f"1. ਮੁੱਖ ਚਿੰਤਾ: {localized['primary']}\n"
            f"2. {localized['field_check']}\n"
            f"3. {localized['timing']} {localized['nutrient']} KVK: {kvk_contact}"
        )
    else:
        message = (
            f"⚠️ {state.district} | {state.crop}\n"
            f"1. Main issue: {localized['primary']}\n"
            f"2. {localized['field_check']}\n"
            f"3. {localized['timing']} {localized['nutrient']} KVK: {kvk_contact}"
        )
    return message[:400]


def render_institutional_report(state: FarmPulseState, kvk_contact: str) -> str:
    report = state.risk_report
    return (
        f"{state.district}, {state.state}: NDVI {state.ndvi_score:.2f} vs baseline {state.ndvi_baseline:.2f} "
        f"({state.ndvi_anomaly_pct:.1f}% anomaly). Risk {report['riskCategory']} ({report['riskScore']}/100), "
        f"confidence {state.confidence:.1f}%. Root cause: {report['rootCause']}. Recommended action window: "
        f"{report['recommendedAction']}. Data freshness: {state.data_freshness_days} days. KVK: {kvk_contact}."
    )


async def satellite_scout(state: FarmPulseState) -> FarmPulseState:
    record = get_district_record(state.district)
    state.state = record.state
    state.district_record = record.model_dump()
    state.crop_supported = state.crop in SUPPORTED_CROPS
    await emit_event(state.run_id, "Satellite Stress Scout", "fetch_ndvi", "RUNNING", f"Scanning {state.district} canopy vigor")
    freshness_days = state.data_freshness_days
    ndvi = synthetic_ndvi(record, state.crop, freshness_days, forced_stress=state.edge_case == "multi_stressor_conflict" if hasattr(state, "edge_case") else False)
    baseline = seasonal_baseline(state.crop)
    anomaly_pct = round(((ndvi - baseline) / baseline) * 100, 1)
    confidence = 93.0
    warnings: list[str] = []
    if freshness_days > 10:
        warnings.append(f"Data staleness detected - NDVI is {freshness_days} days old.")
        confidence = 41.0
    severity = "LOW"
    deficit = abs(anomaly_pct)
    if anomaly_pct <= -25:
        severity = "CRITICAL"
    elif anomaly_pct <= -20:
        severity = "HIGH"
    elif anomaly_pct <= -15:
        severity = "MEDIUM"
    weather = await fetch_weather(record)
    if anomaly_pct <= -15 and weather.rainfall_7d_mm > 200:
        warnings.append("Water stress vs. flood stress ambiguity - request ground validation.")
    state.ndvi_score = ndvi
    state.ndvi_baseline = baseline
    state.ndvi_anomaly_pct = anomaly_pct
    state.weather_data = weather.model_dump()
    state.ndvi_meta = ndvi_reference_meta(record, state.crop, freshness_days, ndvi, baseline)
    state.confidence = confidence
    state.warnings.extend(warnings)
    state.satellite_signal = {
        "district": state.district,
        "crop": state.crop,
        "severity": severity,
        "confidence": confidence,
        "stale": freshness_days > 10,
    }
    state.reasoning_chain.append(
        {
            "title": "Checked NDVI vs seasonal baseline",
            "detail": f"NDVI {ndvi:.2f} vs baseline {baseline:.2f} => {anomaly_pct:.1f}% anomaly ({severity}).",
        }
    )
    add_audit_entry(
        state,
        "Satellite Stress Scout",
        "ndvi_anomaly_scan",
        f"district={state.district}, crop={state.crop}, freshness={freshness_days}",
        f"ndvi={ndvi}, baseline={baseline}, anomaly={anomaly_pct}%, severity={severity}",
        "synthetic-ndvi-engine",
        0,
        confidence,
        severity,
    )
    await emit_event(state.run_id, "Satellite Stress Scout", "fetch_ndvi", "COMPLETE", f"NDVI {ndvi:.2f}; anomaly {anomaly_pct:.1f}%", confidence)
    return state


async def crop_risk_analyst(state: FarmPulseState) -> FarmPulseState:
    await emit_event(state.run_id, "Crop Risk Analyst", "reason_over_signals", "RUNNING", f"Cross-checking weather, crop stage, and pest risk for {state.district}")
    record = get_district_record(state.district)
    stage, days_to_harvest = crop_calendar(record, state.crop)
    pest_probability, pest_name = get_pest_probability(state.district, state.crop)
    weather = WeatherData.model_validate(state.weather_data)
    risk_score = 38 + abs(state.ndvi_anomaly_pct) * 1.3 + max(0, pest_probability - 25) * 0.35
    if weather.weather_anomaly in {"drought", "flood", "heat", "cold"}:
        risk_score += 14
    if state.edge_case == "multi_stressor_conflict":
        risk_score += 18
    risk_score = round(min(96, max(15, risk_score)))
    risk_category = map_risk_category(risk_score)
    confidence = state.confidence
    root_cause = summarize_root_cause(weather, pest_probability, state.crop, state.district)
    recommended_action = "Monitor for 5 days and maintain balanced nutrition"
    escalate = False
    escalation_reason = ""
    phi_compliant = days_to_harvest > 21

    if state.ndvi_anomaly_pct <= -15 and weather.weather_anomaly == "normal":
        root_cause = f"Probable {pest_name.lower()} pressure or nutrient imbalance - ground validation required"
        recommended_action = "Scout 10 plants per acre and confirm symptoms before treatment"
    elif weather.weather_anomaly != "normal" and state.ndvi_anomaly_pct > -10:
        root_cause = "Weather anomaly detected but stress not yet manifested in NDVI - monitor"
        recommended_action = "Monitor canopy and soil moisture for the next 5 days"
    elif state.edge_case == "multi_stressor_conflict":
        root_cause = "Multiple overlapping stressors detected across canopy, weather, and pest windows"
        recommended_action = "Escalate to human agronomist with full district context"
        escalate = True
        escalation_reason = "multi-stressor conflict"

    if not state.crop_supported:
        escalate = True
        confidence = 0
        escalation_reason = "crop type not in domain"
        root_cause = "Unsupported crop domain"
        recommended_action = "Refer farmer to KVK for field-specific guidance"

    if state.data_freshness_days > 10:
        confidence = min(confidence, 41.0)
        escalate = True
        escalation_reason = escalation_reason or "stale satellite data"

    if confidence < 60:
        escalate = True
        escalation_reason = escalation_reason or "confidence below threshold"

    if risk_category in {"HIGH", "CRITICAL"} and not phi_compliant:
        recommended_action = "Use non-chemical options only: pheromone traps, sanitation, and manual scouting"

    state.crop_stage = stage
    state.days_to_harvest = days_to_harvest
    state.pest_risk = pest_name
    state.pest_probability = pest_probability
    state.phi_compliant = phi_compliant
    state.confidence = round(confidence, 1)
    state.escalate = escalate
    state.escalation_reason = escalation_reason
    state.risk_report = {
        "district": state.district,
        "crop": state.crop,
        "riskScore": risk_score,
        "riskCategory": risk_category,
        "rootCause": root_cause,
        "confidenceLevel": state.confidence,
        "recommendedAction": recommended_action,
        "escalate": escalate,
    }
    state.soil_snapshot = build_soil_snapshot(record, state.crop, weather, state.ndvi_score)
    state.forecast_5d = build_forecast_5d(record, weather)
    query_plan = build_query_aware_plan(state)
    state.risk_report["recommendedAction"] = query_plan["recommended_action"]
    state.data_sources = [
        "Farmer query input",
        "Synthetic soil snapshot",
        f"Weather forecast via {weather.source}",
        f"NDVI demo estimate aligned to NASA MODIS MOD13Q1 reference ranges ({state.ndvi_meta.get('resolution', '250 m, 16-day composite')})",
    ]
    state.reasoning_chain.extend(
        [
            {
                "title": "Read farmer query intent",
                "detail": f"Query asks about fertilizer timing={query_plan['signals']['asks_fertilizer_timing']}, yellowing={query_plan['signals']['mentions_yellowing']}, pest concern={query_plan['signals']['mentions_pest']}.",
            },
            {
                "title": "Checked weather trend and 5-day forecast",
                "detail": f"7-day rainfall {weather.rainfall_7d_mm} mm; anomaly type {weather.weather_anomaly}; best current application window is {query_plan['window_label']}.",
            },
            {
                "title": "Checked soil condition snapshot",
                "detail": f"Soil moisture {state.soil_snapshot['moisturePct']}% ({state.soil_snapshot['moistureBand']}), pH {state.soil_snapshot['soilPH']}, nitrogen {state.soil_snapshot['nitrogenKgHa']} kg/ha.",
            },
            {
                "title": "Checked crop stage and pest calendar",
                "detail": f"Stage {stage}; pest window {pest_name} at {pest_probability}% probability.",
            },
        ]
    )
    add_audit_entry(
        state,
        "Crop Risk Analyst",
        "risk_reasoning",
        f"ndvi_anomaly={state.ndvi_anomaly_pct}%, weather={weather.weather_anomaly}, pest={pest_name}",
        f"risk_score={risk_score}, category={risk_category}, escalate={escalate}",
        "domain-reasoner-v2",
        0,
        state.confidence,
        risk_category,
    )
    await emit_event(state.run_id, "Crop Risk Analyst", "reason_over_signals", "COMPLETE", f"Risk {risk_category} ({risk_score}/100)", state.confidence)
    return state


async def advisory_generator(state: FarmPulseState) -> FarmPulseState:
    await emit_event(state.run_id, "Advisory Generator", "compose_advisory", "RUNNING", f"Generating {state.language} advisories")
    kvk_contact = state.district_record["kvk_contact"]
    sms_model = select_model("sms_advisory", "low")
    institutional_model = select_model("institutional_report", "high" if state.escalate else "medium")

    state.model_used = sms_model
    state.advisory_sms = render_sms(state, kvk_contact)
    state.advisory_whatsapp = render_whatsapp(state, kvk_contact)
    state.advisory_institutional = render_institutional_report(state, kvk_contact)
    state.reasoning_chain.append(
        {
            "title": "Generated multilingual advisory with guardrails",
            "detail": "Selected fast farmer messaging and detailed institutional reporting paths.",
        }
    )
    if state.risk_report.get("riskCategory") in {"HIGH", "CRITICAL"}:
        disclaimer = "Consult local Krishi Vigyan Kendra for field verification."
        state.advisory_institutional = f"{state.advisory_institutional} {disclaimer}"
    add_audit_entry(
        state,
        "Advisory Generator",
        "multilingual_generation",
        f"language={state.language}, escalate={state.escalate}",
        f"sms={state.advisory_sms[:80]}",
        sms_model,
        180,
        state.confidence,
        state.risk_report["riskCategory"],
    )
    add_audit_entry(
        state,
        "Advisory Generator",
        "institutional_generation",
        f"district={state.district}, crop={state.crop}",
        f"report_length={len(state.advisory_institutional)}",
        institutional_model,
        420,
        state.confidence,
        state.risk_report["riskCategory"],
    )
    await emit_event(state.run_id, "Advisory Generator", "compose_advisory", "COMPLETE", f"Advisory ready with confidence {state.confidence:.1f}%", round(90.0 if not state.escalate else state.confidence, 1))
    return state


def aggregate_state_risks() -> dict[str, Any]:
    district_rows = []
    for record in DISTRICT_DATA:
        crop = record.primary_crop if record.primary_crop in SUPPORTED_CROPS else "Wheat"
        baseline = seasonal_baseline(crop)
        ndvi = synthetic_ndvi(record, crop, 5, forced_stress=False)
        risk_score = round(min(94, max(22, 35 + abs(((ndvi - baseline) / baseline) * 100) * 1.45)))
        risk_level = map_risk_category(risk_score)
        district_rows.append(
            {
                "id": record.id,
                "district": record.district,
                "state": record.state,
                "crop": crop,
                "ndviScore": ndvi,
                "baseline": baseline,
                "riskScore": risk_score,
                "riskLevel": risk_level,
                "acreageLakh": record.acreage_lakh,
                "lat": record.lat,
                "lon": record.lon,
                "updatedAt": now_iso(),
                "ndviMeta": ndvi_reference_meta(record, crop, 5, ndvi, baseline),
            }
        )
    states: dict[str, list[dict[str, Any]]] = {}
    for row in district_rows:
        states.setdefault(row["state"], []).append(row)
    heatmap = []
    for state_name, rows in states.items():
        avg_risk = round(sum(item["riskScore"] for item in rows) / len(rows), 1)
        critical_count = sum(1 for item in rows if item["riskLevel"] == "CRITICAL")
        heatmap.append(
            {
                "state": state_name,
                "avgRisk": avg_risk,
                "criticalDistricts": critical_count,
                "districtCount": len(rows),
                "emergencyAlert": critical_count >= 3,
            }
        )
    return {"districts": district_rows, "states": heatmap}


async def institutional_reporter(state: FarmPulseState) -> FarmPulseState:
    await emit_event(state.run_id, "Institutional Reporter", "aggregate_outputs", "RUNNING", "Building FPO, insurer, and government views")
    aggregate = aggregate_state_risks()
    high_risk_districts = [row for row in aggregate["districts"] if row["riskLevel"] in {"HIGH", "CRITICAL"}]
    same_state_critical = [
        row for row in high_risk_districts if row["state"] == state.state and row["riskLevel"] == "CRITICAL"
    ]
    emergency_alert = len(same_state_critical) >= 3
    insurer_rows = [
        {
            "district": row["district"],
            "state": row["state"],
            "riskLevel": row["riskLevel"],
            "estimatedAffectedAcreagePct": round(min(48, row["riskScore"] * 0.42), 1),
            "claimProbability": round(min(0.92, row["riskScore"] / 110), 2),
            "confidence": round(max(52, 84 - abs(row["riskScore"] - 70) * 0.2), 1),
        }
        for row in high_risk_districts
    ]
    state.institutional_outputs = {
        "heatmap": aggregate["states"],
        "fpoBriefing": aggregate["districts"],
        "insuranceSignals": insurer_rows,
        "governmentEarlyWarning": {
            "format": "PM Digital Agriculture Mission style",
            "state": state.state,
            "district": state.district,
            "riskCategory": state.risk_report["riskCategory"],
            "generatedAt": now_iso(),
            "dataFreshnessDays": state.data_freshness_days,
            "confidence": state.confidence,
            "emergencyAlert": emergency_alert,
        },
    }
    if emergency_alert:
        state.warnings.append("State-Level Crop Emergency Alert generated and held for human review.")
    add_audit_entry(
        state,
        "Institutional Reporter",
        "aggregate_and_sync",
        f"state={state.state}, risk={state.risk_report['riskCategory']}",
        f"heatmap_states={len(aggregate['states'])}, insurer_signals={len(insurer_rows)}",
        "aggregation-engine-v1",
        0,
        state.confidence,
        state.risk_report["riskCategory"],
    )
    await emit_event(state.run_id, "Institutional Reporter", "aggregate_outputs", "COMPLETE", "Institutional views synced", round(max(60.0, state.confidence - 2.0), 1))
    return state


async def human_escalation_node(state: FarmPulseState) -> FarmPulseState:
    await emit_event(state.run_id, "Human Escalation", "handoff", "RUNNING", f"Escalating: {state.escalation_reason}")
    state.reasoning_chain.append(
        {
            "title": "Escalated to human review",
            "detail": state.escalation_reason or "confidence too low for automated recommendation",
        }
    )
    add_audit_entry(
        state,
        "Human Escalation",
        "handoff_required",
        f"reason={state.escalation_reason}",
        "automation halted for field verification",
        "human-review",
        0,
        state.confidence,
        state.risk_report.get("riskCategory", "MEDIUM"),
    )
    await emit_event(state.run_id, "Human Escalation", "handoff", "COMPLETE", "Case referred to KVK / agronomist", state.confidence)
    return state


async def run_pipeline(payload: AnalyzeRequest | FarmerQueryRequest) -> dict[str, Any]:
    run_id = payload.run_id or str(uuid.uuid4())
    district_record = get_district_record(payload.district)
    resolved_language = resolve_language(payload.language, payload.farmer_query, district_record.language)
    state = FarmPulseState(
        run_id=run_id,
        district=district_record.district,
        state=district_record.state,
        crop=payload.crop.title(),
        language=resolved_language,
        farmer_query=payload.farmer_query,
        phone_type=payload.phone_type,
        data_freshness_days=15 if payload.edge_case == "data_staleness" else 5,
        edge_case=payload.edge_case,
        input_source="farmer-query" if payload.channel == "farmer" else "dashboard",
    )
    await emit_event(run_id, "Orchestrator", "start", "RUNNING", f"Starting analysis for {state.district}, {state.crop}")
    state = await satellite_scout(state)
    state = await crop_risk_analyst(state)
    state = await advisory_generator(state)
    state = await institutional_reporter(state)
    if state.escalate:
        state = await human_escalation_node(state)
    await emit_event(run_id, "Orchestrator", "complete", "COMPLETE", "Analysis complete")
    return {
        "runId": run_id,
        "district": state.district,
        "state": state.state,
        "crop": state.crop,
        "language": state.language,
        "ndviScore": state.ndvi_score,
        "ndviBaseline": state.ndvi_baseline,
        "ndviAnomalyPct": state.ndvi_anomaly_pct,
        "ndviMeta": state.ndvi_meta,
        "weatherData": state.weather_data,
        "cropStage": state.crop_stage,
        "daysToHarvest": state.days_to_harvest,
        "pestRisk": state.pest_risk,
        "pestProbability": state.pest_probability,
        "riskReport": state.risk_report,
        "advisorySms": state.advisory_sms,
        "advisoryWhatsapp": state.advisory_whatsapp,
        "advisoryInstitutional": state.advisory_institutional,
        "reasoningChain": state.reasoning_chain,
        "auditLog": state.audit_log,
        "confidence": state.confidence,
        "warnings": state.warnings,
        "escalate": state.escalate,
        "escalationReason": state.escalation_reason,
        "dataFreshnessDays": state.data_freshness_days,
        "modelUsed": state.model_used,
        "institutionalOutputs": state.institutional_outputs,
        "districtRecord": state.district_record,
        "soilSnapshot": state.soil_snapshot,
        "forecast5d": state.forecast_5d,
        "dataSources": state.data_sources,
        "inputSource": state.input_source,
        "farmerQuery": state.farmer_query,
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "FarmPulse Agent Engine"}




@app.post("/api/analyze")
async def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    return await run_pipeline(request)


@app.post("/api/farmer-query")
async def farmer_query(request: FarmerQueryRequest) -> dict[str, Any]:
    return await run_pipeline(request)


@app.post("/api/simulate-edge-case")
async def simulate_edge_case(request: EdgeCaseRequest) -> dict[str, Any]:
    payload = AnalyzeRequest(
        district=request.district,
        crop=request.crop if request.scenario != "unknown_crop" else "Moringa",
        language=request.language,
        farmer_query="Simulated edge case run",
        edge_case=request.scenario,
        run_id=request.run_id,
        channel="farmer",
    )
    return await run_pipeline(payload)


@app.get("/api/districts")
async def get_districts() -> dict[str, Any]:
    aggregate = aggregate_state_risks()
    return {
        "districts": aggregate["districts"],
        "states": aggregate["states"],
        "ndviSource": {
            "mode": "demo_estimate",
            "sourceName": "NASA Earthdata MODIS MOD13Q1 V061",
            "sourceUrl": "https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061",
            "resolution": "250 m, 16-day composite",
            "note": "District NDVI shown in this demo is estimated from crop-season baselines and stress signals, then labeled against official NASA MODIS NDVI reference ranges rather than live satellite pixel extraction.",
        },
        "summary": {
            "districtsMonitored": len(aggregate["districts"]),
            "activeAlerts": sum(1 for row in aggregate["districts"] if row["riskLevel"] in {"HIGH", "CRITICAL"}),
            "farmersCovered": 86000000,
            "lastScanTimestamp": now_iso(),
        },
    }


@app.get("/api/district/{district_id}")
async def get_district(district_id: str) -> dict[str, Any]:
    record = get_district_record(district_id)
    response = await run_pipeline(
        AnalyzeRequest(
            district=record.district,
            crop=record.primary_crop if record.primary_crop in SUPPORTED_CROPS else "Wheat",
            language=record.language,
            farmer_query="District detail request",
        )
    )
    return response




@app.get('/api/mandi-price')
async def get_mandi_price(district: str, crop: str) -> dict[str, Any]:
    record = get_district_record(district)
    selected_crop = crop.title()
    return await fetch_mandi_price(record, selected_crop)


@app.get("/api/audit-log")
async def get_audit_log(
    agent: Optional[str] = None,
    district: Optional[str] = None,
    risk_level: Optional[str] = Query(None, alias="riskLevel"),
) -> dict[str, Any]:
    query = "SELECT timestamp, run_id, district, state, crop, agent, action, input_summary, output_summary, model_used, tokens_consumed, confidence, escalation, risk_level FROM audit_log WHERE 1=1"
    params: list[Any] = []
    if agent:
        query += " AND agent = ?"
        params.append(agent)
    if district:
        query += " AND district = ?"
        params.append(district)
    if risk_level:
        query += " AND risk_level = ?"
        params.append(risk_level)
    query += " ORDER BY timestamp DESC LIMIT 500"
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(query, params).fetchall()
    entries = [
        {
            "timestamp": row[0],
            "runId": row[1],
            "district": row[2],
            "state": row[3],
            "crop": row[4],
            "agent": row[5],
            "action": row[6],
            "inputSummary": row[7],
            "outputSummary": row[8],
            "modelUsed": row[9],
            "tokensConsumed": row[10],
            "confidence": row[11],
            "escalation": bool(row[12]),
            "riskLevel": row[13],
        }
        for row in rows
    ]
    return {"entries": entries}


@app.get("/api/audit-log/export")
async def export_audit_log() -> StreamingResponse:
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            "SELECT timestamp, run_id, district, state, crop, agent, action, input_summary, output_summary, model_used, tokens_consumed, confidence, escalation, risk_level FROM audit_log ORDER BY timestamp DESC LIMIT 1000"
        ).fetchall()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["timestamp", "run_id", "district", "state", "crop", "agent", "action", "input_summary", "output_summary", "model_used", "tokens_consumed", "confidence", "escalation", "risk_level"])
    writer.writerows(rows)
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=farmpulse-audit.csv"})


@app.get("/api/stream/{run_id}")
async def stream_events(run_id: str) -> StreamingResponse:
    queue = RUN_QUEUES.setdefault(run_id, asyncio.Queue())

    async def event_stream() -> AsyncGenerator[str, None]:
        yield f"data: {json.dumps({'agent': 'System', 'step': 'connected', 'status': 'IDLE', 'message': 'Stream connected', 'timestamp': now_iso(), 'run_id': run_id})}\n\n"
        while True:
            message = await queue.get()
            yield message
            if '"step": "complete"' in message:
                break

    return StreamingResponse(event_stream(), media_type="text/event-stream")
