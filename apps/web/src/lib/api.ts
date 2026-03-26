import type { AnalysisResponse, AuditEntry, DistrictsResponse } from '../types/farmpulse';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

const defaultQuery = 'माझ्या कापूस पिकावर पिवळे डाग पडत आहेत. खत कधी द्यावे?';

function url(path: string) {
  return `${API_BASE}${path}`;
}

export async function fetchDistricts(): Promise<DistrictsResponse> {
  const response = await fetch(url('/api/districts'));
  if (!response.ok) {
    throw new Error('Failed to load district summaries');
  }
  return response.json();
}

export async function fetchDistrictDetail(districtId: string): Promise<AnalysisResponse> {
  const response = await fetch(url(`/api/district/${districtId}`));
  if (!response.ok) {
    throw new Error('Failed to load district detail');
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
  return response.json();
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
  return response.json();
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
  return response.json();
}

export async function fetchAuditLog(filters?: { agent?: string; district?: string; riskLevel?: string }): Promise<{ entries: AuditEntry[] }> {
  const search = new URLSearchParams();
  if (filters?.agent) search.set('agent', filters.agent);
  if (filters?.district) search.set('district', filters.district);
  if (filters?.riskLevel) search.set('riskLevel', filters.riskLevel);
  const response = await fetch(url(`/api/audit-log${search.toString() ? `?${search.toString()}` : ''}`));
  if (!response.ok) {
    throw new Error('Failed to load audit log');
  }
  return response.json();
}

export function createEventSource(runId: string) {
  return new EventSource(url(`/api/stream/${runId}`));
}

export function exportAuditLogUrl() {
  return url('/api/audit-log/export');
}
