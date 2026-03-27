import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const template = await readFile(path.join(distDir, 'index.html'), 'utf8');

const sharedHead = `
<style>
  :root { color-scheme: light; --border:#d8e8dd; --text:#173624; --muted:#4f6b58; --primary:#1f7a4d; }
  body { margin:0; background:radial-gradient(circle at top,#f6fbf7 0%,#eef6f0 45%,#f9fcfa 100%); color:var(--text); font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,sans-serif; }
  .shell { max-width:1180px; margin:0 auto; padding:40px 24px 64px; }
  .hero { border:1px solid var(--border); border-radius:28px; background:linear-gradient(135deg,rgba(31,122,77,0.10),rgba(245,158,11,0.08)); padding:28px; box-shadow:0 18px 45px rgba(20,44,31,0.08); }
  .eyebrow { font-size:12px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; color:var(--muted); }
  h1 { margin:10px 0 0; font-size:38px; line-height:1.1; }
  p { line-height:1.7; }
  .lede { max-width:860px; font-size:16px; color:var(--muted); }
  .grid { display:grid; gap:18px; margin-top:24px; }
  .grid.cols-2 { grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); }
  .grid.cols-3 { grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
  .card { border:1px solid var(--border); border-radius:24px; background:#fff; padding:20px; box-shadow:0 16px 40px rgba(20,44,31,0.06); }
  .card h2,.card h3 { margin:0 0 10px; }
  .badge { display:inline-block; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:700; }
  .badge.amber { background:#fef3c7; color:#92400e; }
  .badge.red { background:#fee2e2; color:#991b1b; }
  ul { margin:0; padding-left:20px; }
  li { margin:8px 0; color:var(--muted); }
  a { color:var(--primary); text-decoration:none; }
  .nav { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
  .nav a { border:1px solid var(--border); background:rgba(255,255,255,0.8); border-radius:999px; padding:10px 14px; font-size:14px; }
  .phone { border:1px solid #0f172a; border-radius:32px; background:#0f172a; padding:8px; max-width:320px; }
  .phone-screen { border-radius:24px; background:linear-gradient(180deg,#f8fafc 0%,#eef6f1 100%); padding:16px; min-height:360px; }
  .bubble-user { margin-left:auto; max-width:86%; background:#1f7a4d; color:#fff; border-radius:18px 18px 6px 18px; padding:12px 14px; }
  .bubble-agent { margin-top:12px; max-width:92%; background:#fff; color:#173624; border-radius:18px 18px 18px 6px; padding:12px 14px; box-shadow:0 8px 18px rgba(15,23,42,0.08); }
  .footer-note { margin-top:16px; font-size:14px; color:var(--muted); }
</style>`;

const pages = {
  overview: {
    title: 'FarmPulse AI Overview',
    description: 'Command center for live crop-risk monitoring, agent execution, and quantified impact.',
    body: `<div class="hero"><div class="eyebrow">Command Center</div><h1>FarmPulse Agentic Dashboard</h1><p class="lede">This page shows the live institutional overview: four coordinated agents, NDVI stress mapping, agent activity, and quantified business impact for India’s smallholder network.</p><div class="nav"><a href="/farmer-advisory">Farmer Advisory</a><a href="/districts">District Explorer</a><a href="/institutional">Institutional Reports</a><a href="/audit">Audit Logs</a></div></div><div class="grid cols-3"><div class="card"><h3>4-Agent Flow</h3><p>Satellite Stress Scout, Crop Risk Analyst, Advisory Generator, and Institutional Reporter run in sequence with visible progress.</p></div><div class="card"><h3>Impact Quantification</h3><p>₹15K-30K avg seasonal loss prevented × 86M farmers = ₹2.5L Cr addressable impact.</p></div><div class="card"><h3>What Judges See</h3><p>Agent status, map-based district stress, activity feed, and a one-click full analysis run.</p></div></div>`
  },
  'farmer-advisory': {
    title: 'FarmPulse AI Farmer Advisory',
    description: 'Multilingual farmer advisory with Marathi voice-note demo, visible agent steps, escalation state, and audit handoff.',
    body: `<div class="hero"><div class="eyebrow">Farmer Help</div><h1>Multilingual Farmer Advisory</h1><p class="lede">This is the flagship demo flow: a farmer in Yavatmal asks in Marathi about fertilizer timing. The system simulates voice input, reasons across NDVI, weather, soil, and pest signals, then returns the answer in the same language.</p></div><div class="grid cols-2"><div class="card"><h2>Simulated Voice Input</h2><p>A Marathi voice-note demo populates the farmer query field and runs the full pipeline automatically.</p><div class="phone"><div class="phone-screen"><div class="bubble-user">माझ्या कापूस पिकावर पिवळे डाग पडत आहेत. खत कधी द्यावे?</div><div class="bubble-agent">यवतमाळमध्ये सध्याच्या हवामान आणि मातीच्या स्थितीनुसार कोरड्या दिवसात विभाजित नायट्रोजन द्या. कीड तपासणी करा आणि KVK शी संपर्क साधा.</div></div></div><p class="footer-note">The live page also shows the four agent steps, per-agent confidence badges, SMS advisory, institutional report, and a direct audit link.</p></div><div class="card"><h2>Visible Guardrails</h2><p><span class="badge amber">Escalation Demo</span></p><p>The page includes a one-click escalation path. When confidence drops below threshold, the UI switches to a high-visibility refusal state: <strong>Escalated to KVK agronomist. No recommendation fabricated.</strong></p><ul><li>4 sequential agent steps stream live via SSE</li><li>Per-agent confidence is shown on the step cards</li><li>Final output includes SMS advisory, risk score, model route, and audit trace</li></ul></div></div>`
  },
  districts: {
    title: 'FarmPulse AI District Explorer',
    description: 'District-level NDVI stress explorer with provenance, reasoning, and advisory generation.',
    body: `<div class="hero"><div class="eyebrow">District Explorer</div><h1>NDVI Stress Heat Map and District Risk Explorer</h1><p class="lede">This page combines district NDVI stress visualization, source transparency, risk summaries, and drill-down district reporting.</p></div><div class="grid cols-2"><div class="card"><h2>NDVI Stress Heat Map</h2><p>District NDVI is rendered as a green-to-red stress layer. Values are demo-estimated and anchored to official NASA MODIS reference ranges.</p></div><div class="card"><h2>NDVI Source</h2><p>Demo-estimated NDVI aligned to NASA MODIS reference ranges. NASA Earthdata MODIS MOD13Q1 V061 · 250 m, 16-day composite.</p></div></div>`
  },
  institutional: {
    title: 'FarmPulse AI Institutional Reports',
    description: 'FPO, insurer, and government-facing dashboard with institutional guardrails.',
    body: `<div class="hero"><div class="eyebrow">Institutional</div><h1>FPO, Insurer, and Government Dashboard</h1><p class="lede">This page aggregates district-level risk into insurer pre-claim signals, government early warning, and institutional reporting outputs.</p></div><div class="grid cols-2"><div class="card"><h2>Institutional Guardrail Demo</h2><p><span class="badge red">Blocked When Stale</span></p><p>If NDVI data is older than 14 days, the insurance pre-claim signal is blocked for manual review instead of being forwarded downstream.</p></div><div class="card"><h2>Outputs</h2><ul><li>Government early warning state summaries</li><li>Insurance pre-claim signal table</li><li>FPO-ready district briefing table</li></ul></div></div>`
  },
  audit: {
    title: 'FarmPulse AI Audit Logs',
    description: 'Chronological audit trail of every agent action with filters and export.',
    body: `<div class="hero"><div class="eyebrow">Auditability</div><h1>Full Agent Audit Trail</h1><p class="lede">Every agent action is timestamped, confidence-scored, and exportable so reviewers can inspect exactly how a decision was made.</p></div><div class="grid cols-2"><div class="card"><h2>What is Logged</h2><ul><li>Agent name and action</li><li>Confidence and escalation state</li><li>Input and output summaries</li><li>Run-level filtering</li></ul></div><div class="card"><h2>Judge Value</h2><p>The farmer flow links directly into the exact audit trace for the executed run.</p></div></div>`
  },
  'channel-fallback': {
    title: 'FarmPulse AI Channels',
    description: 'WhatsApp and SMS fallback simulation for real-world farmer delivery.',
    body: `<div class="hero"><div class="eyebrow">Channels</div><h1>WhatsApp and SMS Fallback</h1><p class="lede">This page shows how the same advisory is delivered through farmer-friendly channels used in the field.</p></div>`
  },
  'mandi-prices': {
    title: 'FarmPulse AI Mandi Prices',
    description: 'Mandi price intelligence with crop-specific sell-or-hold guidance.',
    body: `<div class="hero"><div class="eyebrow">Markets</div><h1>Mandi Price Intelligence</h1><p class="lede">This page combines crop-risk analysis with mandi pricing to support sell-or-hold decisions.</p></div>`
  }
};

for (const [route, page] of Object.entries(pages)) {
  const html = template
    .replace('</head>', `${sharedHead}\n<title>${page.title}</title>\n<meta name="description" content="${page.description}" />\n</head>`)
    .replace('<div id="root"></div>', `<div id="root"><main class="shell">${page.body}</main></div>`);
  const routeDir = path.join(distDir, route);
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, 'index.html'), html, 'utf8');
}
