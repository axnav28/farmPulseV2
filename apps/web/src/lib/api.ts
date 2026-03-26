import type { AnalysisResponse, AuditEntry, DistrictsResponse, MandiPriceResponse } from '../types/farmpulse';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const AUDIT_CACHE_KEY = 'farmpulse.audit.entries';

const defaultQuery = 'माझ्या कापूस पिकावर पिवळे डाग पडत आहेत. खत कधी द्यावे?';

function url(path: string) {
  return API_BASE + path;
}

function readCachedAuditEntries(): AuditEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(AUDIT_CACHE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as AuditEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedAuditEntries(entries: AuditEntry[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(AUDIT_CACHE_KEY, JSON.stringify(entries.slice(0, 200)));
  } catch {
    // Ignore storage failures and continue with backend-only audit data.
  }
}

function mergeAuditEntries(primary: AuditEntry[], secondary: AuditEntry[]): AuditEntry[] {
  const merged = [...primary, ...secondary];
  const byKey = new Map<string, AuditEntry>();

  for (const entry of merged) {
    const key = [entry.runId, entry.timestamp, entry.agent, entry.action, entry.outputSummary].join('|');
    byKey.set(key, entry);
  }

  return [...byKey.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

function persistAuditEntries(entries: AuditEntry[]) {
  if (!entries.length) {
    return;
  }
  const cached = readCachedAuditEntries();
  writeCachedAuditEntries(mergeAuditEntries(entries, cached));
}

function filterAuditEntries(entries: AuditEntry[], filters?: { agent?: string; district?: string; riskLevel?: string }) {
  return entries.filter((entry) => {
    if (filters?.agent && !entry.agent.toLowerCase().includes(filters.agent.toLowerCase())) {
      return false;
    }
    if (filters?.district && !entry.district.toLowerCase().includes(filters.district.toLowerCase())) {
      return false;
    }
    if (filters?.riskLevel && entry.riskLevel.toLowerCase() !== filters.riskLevel.toLowerCase()) {
      return false;
    }
    return true;
  });
}

export async function fetchDistricts(): Promise<DistrictsResponse> {
  const response = await fetch(url('/api/districts'));
  if (!response.ok) {
    throw new Error('Failed to load district summaries');
  }
  return response.json();
}

export async function fetchDistrictDetail(districtId: string): Promise<AnalysisResponse> {
  const response = await fetch(url('/api/district/' + districtId));
  if (!response.ok) {
    throw new Error('Failed to load district detail');
  }
  const payload = (await response.json()) as AnalysisResponse;
  persistAuditEntries(payload.auditLog);
  return payload;
}

export async function fetchMandiPrice(params: { district: string; crop: string }): Promise<MandiPriceResponse> {
  const search = new URLSearchParams({ district: params.district, crop: params.crop });
  const response = await fetch(url('/api/mandi-price?' + search.toString()));
  if (!response.ok) {
    throw new Error('Failed to load mandi price');
  }
  return response.json();
}

export async function runAnalysis(payload: {
  district: string;
  crop: string;
  language: string;
  farmer_query?: string;
  run_id: string;
  edge_case?: string;
}): Promise<AnalysisResponse> {
  const response = await fetch(url('/api/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      district: payload.district,
      crop: payload.crop,
      language: payload.language,
      farmer_query: payload.farmer_query ?? defaultQuery,
      run_id: payload.run_id,
      edge_case: payload.edge_case,
    }),
  });
  if (!response.ok) {
    throw new Error('Analysis run failed');
  }
  const result = (await response.json()) as AnalysisResponse;
  persistAuditEntries(result.auditLog);
  return result;
}

export async function runFarmerQuery(payload: {
  district: string;
  crop: string;
  language: string;
  farmer_query: string;
  run_id: string;
  edge_case?: string;
}): Promise<AnalysisResponse> {
  const response = await fetch(url('/api/farmer-query'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Farmer advisory request failed');
  }
  const result = (await response.json()) as AnalysisResponse;
  persistAuditEntries(result.auditLog);
  return result;
}

export async function simulateEdgeCase(payload: {
  scenario: string;
  district: string;
  crop: string;
  language: string;
  run_id: string;
}): Promise<AnalysisResponse> {
  const response = await fetch(url('/api/simulate-edge-case'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Edge case simulation failed');
  }
  const result = (await response.json()) as AnalysisResponse;
  persistAuditEntries(result.auditLog);
  return result;
}

export async function fetchAuditLog(filters?: { agent?: string; district?: string; riskLevel?: string }): Promise<{ entries: AuditEntry[] }> {
  const search = new URLSearchParams();
  if (filters?.agent) search.set('agent', filters.agent);
  if (filters?.district) search.set('district', filters.district);
  if (filters?.riskLevel) search.set('riskLevel', filters.riskLevel);
  const suffix = search.toString() ? '?' + search.toString() : '';
  const response = await fetch(url('/api/audit-log' + suffix));
  if (!response.ok) {
    throw new Error('Failed to load audit log');
  }
  const payload = (await response.json()) as { entries: AuditEntry[] };
  const mergedEntries = filterAuditEntries(mergeAuditEntries(payload.entries, readCachedAuditEntries()), filters);
  return { entries: mergedEntries };
}

export function createEventSource(runId: string) {
  return new EventSource(url('/api/stream/' + runId));
}

export function exportAuditLogUrl() {
  return url('/api/audit-log/export');
}
