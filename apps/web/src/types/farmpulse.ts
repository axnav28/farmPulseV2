export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AgentStatus = 'IDLE' | 'RUNNING' | 'COMPLETE' | 'ERROR';

export interface DistrictSummary {
  id: string;
  district: string;
  state: string;
  crop: string;
  ndviScore: number;
  baseline: number;
  riskScore: number;
  riskLevel: RiskLevel;
  acreageLakh: number;
  lat: number;
  lon: number;
  updatedAt: string;
}

export interface StateSummary {
  state: string;
  avgRisk: number;
  criticalDistricts: number;
  districtCount: number;
  emergencyAlert: boolean;
}

export interface DistrictsResponse {
  districts: DistrictSummary[];
  states: StateSummary[];
  summary: {
    districtsMonitored: number;
    activeAlerts: number;
    farmersCovered: number;
    lastScanTimestamp: string;
  };
}

export interface RiskReport {
  district: string;
  crop: string;
  riskScore: number;
  riskCategory: RiskLevel;
  rootCause: string;
  confidenceLevel: number;
  recommendedAction: string;
  escalate: boolean;
}

export interface WeatherData {
  rainfall_7d_mm: number;
  rainfall_anomaly_pct: number;
  avg_temp_c: number;
  temp_anomaly_c: number;
  humidity_pct: number;
  weather_anomaly: string;
  source: string;
  stale: boolean;
}

export interface AgentEvent {
  agent: string;
  step: string;
  status: AgentStatus;
  message: string;
  timestamp: string;
  run_id: string;
}

export interface ForecastDay {
  day: string;
  date: string;
  rainMm: number;
  maxTempC: number;
  minTempC: number;
  humidityPct: number;
  outlook: string;
}

export interface SoilSnapshot {
  moisturePct: number;
  moistureBand: string;
  soilPH: number;
  nitrogenKgHa: number;
  electricalConductivity: number;
  summary: string;
}

export interface AnalysisResponse {
  runId: string;
  district: string;
  state: string;
  crop: string;
  language: string;
  ndviScore: number;
  ndviBaseline: number;
  ndviAnomalyPct: number;
  weatherData: WeatherData;
  cropStage: string;
  daysToHarvest: number;
  pestRisk: string;
  pestProbability: number;
  riskReport: RiskReport;
  advisorySms: string;
  advisoryWhatsapp: string;
  advisoryInstitutional: string;
  reasoningChain: Array<{ title: string; detail: string }>;
  auditLog: AuditEntry[];
  confidence: number;
  warnings: string[];
  escalate: boolean;
  escalationReason: string;
  dataFreshnessDays: number;
  modelUsed: string;
  soilSnapshot: SoilSnapshot;
  forecast5d: ForecastDay[];
  dataSources: string[];
  inputSource: string;
  farmerQuery: string;
  institutionalOutputs: {
    heatmap: StateSummary[];
    fpoBriefing: DistrictSummary[];
    insuranceSignals: Array<{
      district: string;
      state: string;
      riskLevel: RiskLevel;
      estimatedAffectedAcreagePct: number;
      claimProbability: number;
      confidence: number;
    }>;
    governmentEarlyWarning: {
      format: string;
      state: string;
      district: string;
      riskCategory: RiskLevel;
      generatedAt: string;
      dataFreshnessDays: number;
      confidence: number;
      emergencyAlert: boolean;
    };
  };
  districtRecord: {
    district: string;
    state: string;
    kvk_contact: string;
    primary_crop: string;
  };
}

export interface AuditEntry {
  timestamp: string;
  runId: string;
  district: string;
  state: string;
  crop: string;
  agent: string;
  action: string;
  inputSummary: string;
  outputSummary: string;
  modelUsed: string;
  tokensConsumed: number;
  confidence: number;
  escalation: boolean;
  riskLevel: RiskLevel;
}
