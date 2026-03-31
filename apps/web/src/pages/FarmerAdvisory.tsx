import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CloudRain, Droplets, Leaf, Mic, Send, Square, Waves } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { createEventSource, fetchDistricts, runFarmerQuery, simulateEdgeCase } from '../lib/api';
import type { AgentEvent, AgentStatus, AnalysisResponse, DistrictsResponse, ForecastDay } from '../types/farmpulse';

type BrowserSpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

const sampleQueries: Record<string, string> = {
  Auto: 'माझ्या कापूस पिकावर पिवळे डाग पडत आहेत. खत कधी द्यावे?',
  Marathi: 'माझ्या कापूस पिकावर पिवळे डाग पडत आहेत. खत कधी द्यावे?',
  Hindi: 'मेरी कपास की फसल की पत्तियां पीली पड़ रही हैं। खाद कब डालूं?',
  Punjabi: 'ਮੇਰੀ ਕਪਾਹ ਦੀ ਫਸਲ ਦੇ ਪੱਤੇ ਪੀਲੇ ਹੋ ਰਹੇ ਹਨ। ਖਾਦ ਕਦੋਂ ਪਾਵਾਂ?',
  English: 'My cotton crop leaves are turning yellow. When should I apply fertilizer?',
  Bengali: 'আমার তুলার পাতাগুলো হলুদ হয়ে যাচ্ছে। সার কখন দেব?',
  Gujarati: 'મારી કપાસની પાંદડીઓ પીળી પડી રહી છે. ખાતર ક્યારે આપવું?',
  Tamil: 'என் பருத்தி பயிரின் இலைகள் மஞ்சளாகின்றன. உரத்தை எப்போது இட வேண்டும்?',
  Telugu: 'నా పత్తి పంట ఆకులు పసుపుగా మారుతున్నాయి. ఎరువు ఎప్పుడు వేయాలి?',
  Kannada: 'ನನ್ನ ಹತ್ತಿ ಬೆಳೆ ಎಲೆಗಳು ಹಳದಿಯಾಗುತ್ತಿವೆ. ರಸಗೊಬ್ಬರವನ್ನು ಯಾವಾಗ ಹಾಕಬೇಕು?',
  Malayalam: 'എന്റെ പരുത്തി വിളയുടെ ഇലകൾ മഞ്ഞയായി മാറുന്നു. വളം എപ്പോൾ ഇടണം?',
};

const speechLanguageMap: Record<string, string> = {
  Auto: 'mr-IN',
  Marathi: 'mr-IN',
  Hindi: 'hi-IN',
  Punjabi: 'pa-IN',
  English: 'en-IN',
  Bengali: 'bn-IN',
  Gujarati: 'gu-IN',
  Tamil: 'ta-IN',
  Telugu: 'te-IN',
  Kannada: 'kn-IN',
  Malayalam: 'ml-IN',
};

const defaultQuery = sampleQueries.Marathi;
const marathiSampleSpokenText = 'माझ्या कापूस पिकावर पिवळे डाग पडत आहेत खत कधी द्यावे';
const englishDemoQuery = sampleQueries.English;
const hindiDemoQuery = sampleQueries.Hindi;
const languageOptions = ['Auto', 'Marathi', 'Hindi', 'Punjabi', 'English', 'Bengali', 'Gujarati', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'];

type AgentFlowStep = {
  agent: string;
  title: string;
  status: AgentStatus;
  message: string;
  step: string;
  confidence?: number | null;
};

const defaultAgentFlow: AgentFlowStep[] = [
  { agent: 'Satellite Stress Scout', title: '1. Satellite Stress Scout', status: 'IDLE', message: 'Waiting to ingest NDVI, data freshness, and district weather context.', step: 'ready', confidence: null },
  { agent: 'Crop Risk Analyst', title: '2. Crop Risk Analyst', status: 'IDLE', message: 'Waiting to score risk, infer root cause, and decide escalation.', step: 'ready', confidence: null },
  { agent: 'Advisory Generator', title: '3. Advisory Generator', status: 'IDLE', message: 'Waiting to generate the farmer SMS, WhatsApp answer, and model route.', step: 'ready', confidence: null },
  { agent: 'Institutional Reporter', title: '4. Institutional Reporter', status: 'IDLE', message: 'Waiting to attach the institutional report and audit-ready record.', step: 'ready', confidence: null },
];

function getSampleQuery(language: string, districtLanguage?: string) {
  if (language === 'Auto') {
    return sampleQueries[districtLanguage ?? 'Marathi'] ?? sampleQueries.Auto;
  }
  return sampleQueries[language] ?? sampleQueries.Auto;
}

function speechLanguageFor(language: string, state?: string) {
  if (language === 'Auto') {
    if (state === 'Punjab') return 'pa-IN';
    if (state === 'Maharashtra') return 'mr-IN';
    return 'hi-IN';
  }
  return speechLanguageMap[language] ?? 'hi-IN';
}

function sanitizeSpeechText(text: string) {
  return text.replace(/[!?.,:;]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickPreferredSpeechVoice(preferredLanguages: string[]) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    return null;
  }

  const normalized = preferredLanguages.map((item) => item.toLowerCase());
  for (const preferred of normalized) {
    const exact = voices.find((voice) => voice.lang?.toLowerCase() === preferred);
    if (exact) return exact;

    const partial = voices.find((voice) => voice.lang?.toLowerCase().startsWith(preferred));
    if (partial) return partial;
  }

  const indicNameFallback = voices.find((voice) => /marathi|hindi|indic|india/i.test(`${voice.name} ${voice.lang}`));
  return indicNameFallback ?? null;
}

export default function FarmerAdvisory() {
  const [districtsData, setDistrictsData] = useState<DistrictsResponse | null>(null);
  const [district, setDistrict] = useState('Yavatmal');
  const [crop, setCrop] = useState('Cotton');
  const [language, setLanguage] = useState('Auto');
  const [query, setQuery] = useState(defaultQuery);
  const [response, setResponse] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentFlow, setAgentFlow] = useState<AgentFlowStep[]>(defaultAgentFlow);
  const [activeRunId, setActiveRunId] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResponses, setDemoResponses] = useState<{ English: AnalysisResponse | null; Hindi: AnalysisResponse | null }>({ English: null, Hindi: null });
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlayingSampleVoice, setIsPlayingSampleVoice] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    fetchDistricts()
      .then(setDistrictsData)
      .catch(() => toast.error('Could not load districts'));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setVoiceSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  const currentDistrict = useMemo(
    () => districtsData?.districts.find((item) => item.district === district),
    [districtsData, district],
  );

  const bestDay = useMemo(() => selectBestDay(response?.forecast5d ?? []), [response]);
  const sampleQuery = useMemo(
    () => getSampleQuery(language, currentDistrict?.state === 'Maharashtra' ? 'Marathi' : currentDistrict?.state === 'Punjab' ? 'Punjabi' : 'Hindi'),
    [language, currentDistrict],
  );

  useEffect(() => {
    setQuery((current) => {
      const knownSamples = new Set(Object.values(sampleQueries));
      if (!current.trim() || knownSamples.has(current)) {
        return sampleQuery;
      }
      return current;
    });
  }, [sampleQuery]);

  useEffect(() => {
    setDemoResponses({ English: null, Hindi: null });
  }, [district, crop]);

  useEffect(() => {
    setAgentFlow(defaultAgentFlow);
    setActiveRunId('');
  }, [district, crop]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
  }, []);

  function startVoiceInput() {
    if (typeof window === 'undefined') return;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error('Voice input is not supported in this browser');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = speechLanguageFor(language, currentDistrict?.state);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();

      if (transcript) {
        setQuery(transcript);
        toast.success('Voice input captured');
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      toast.error(event.error === 'not-allowed' ? 'Microphone permission denied' : 'Voice input failed');
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  function stopVoiceInput() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  async function playSampleVoiceDemo() {
    const marathiSample = sampleQueries.Marathi;
    const spokenSample = sanitizeSpeechText(marathiSampleSpokenText);
    setLanguage('Marathi');
    setDistrict('Yavatmal');
    setCrop('Cotton');
    setQuery(marathiSample);
    setIsPlayingSampleVoice(true);

    const finish = async () => {
      setIsPlayingSampleVoice(false);
      toast.success('Marathi voice note transcribed into the query box');
      await runPipelineWithQuery(marathiSample, 'Marathi');
    };

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spokenSample);
        const selectedVoice = pickPreferredSpeechVoice(['mr-IN', 'mr', 'hi-IN', 'hi']);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang || 'mr-IN';
        } else {
          utterance.lang = 'hi-IN';
        }
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.onend = () => {
          void finish();
        };
        utterance.onerror = () => {
          window.setTimeout(() => {
            void finish();
          }, 1200);
        };

        const voices = window.speechSynthesis.getVoices();
        if (!voices.length && 'onvoiceschanged' in window.speechSynthesis) {
          const synth = window.speechSynthesis;
          const previous = synth.onvoiceschanged;
          synth.onvoiceschanged = () => {
            synth.onvoiceschanged = previous ?? null;
            const lateVoice = pickPreferredSpeechVoice(['mr-IN', 'mr', 'hi-IN', 'hi']);
            if (lateVoice) {
              utterance.voice = lateVoice;
              utterance.lang = lateVoice.lang || 'mr-IN';
            }
            synth.speak(utterance);
          };
          window.setTimeout(() => {
            if (synth.speaking || synth.pending) return;
            synth.onvoiceschanged = previous ?? null;
            synth.speak(utterance);
          }, 250);
          return;
        }

        window.speechSynthesis.speak(utterance);
        return;
      } catch {
        // Fall through to timer-based simulation.
      }
    }

    window.setTimeout(() => {
      void finish();
    }, 1200);
  }

  async function runPipelineWithQuery(farmerQuery: string, forcedLanguage = language) {
    const runId = crypto.randomUUID();
    setLoading(true);
    setResponse(null);
    setActiveRunId(runId);
    setAgentFlow(defaultAgentFlow);
    const source = createEventSource(runId);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as AgentEvent;
      if (payload.agent !== 'System') {
        setAgentFlow((current) => current.map((item) => (item.agent === payload.agent ? { ...item, status: payload.status, message: payload.message, step: payload.step, confidence: payload.confidence ?? item.confidence ?? null } : item)));
      }
    };

    try {
      const result = await runFarmerQuery({
        district,
        crop,
        language: forcedLanguage,
        farmer_query: farmerQuery,
        run_id: runId,
      });
      setResponse(result);
      setLanguage(result.language);
      setAgentFlow((current) => current.map((item) => ({
        ...item,
        status: item.status === 'ERROR' ? 'ERROR' : 'COMPLETE',
      })));
      toast.success(`Advisory ready in ${result.language}`);
    } catch {
      setAgentFlow((current) => current.map((item) => ({
        ...item,
        status: item.status === 'COMPLETE' ? 'COMPLETE' : 'ERROR',
        message: item.status === 'COMPLETE' ? item.message : 'Run did not complete for this agent.',
      })));
      toast.error('Agent run failed');
    } finally {
      setLoading(false);
      source.close();
    }
  }

  async function loadBilingualDemo() {
    setDemoLoading(true);
    try {
      const [english, hindi] = await Promise.all([
        runFarmerQuery({
          district,
          crop,
          language: 'English',
          farmer_query: englishDemoQuery,
          run_id: crypto.randomUUID(),
        }),
        runFarmerQuery({
          district,
          crop,
          language: 'Hindi',
          farmer_query: hindiDemoQuery,
          run_id: crypto.randomUUID(),
        }),
      ]);
      setDemoResponses({ English: english, Hindi: hindi });
      toast.success('English and Hindi phone demo ready');
    } catch {
      toast.error('Could not load bilingual demo');
    } finally {
      setDemoLoading(false);
    }
  }

  async function execute() {
    await runPipelineWithQuery(query, language);
  }

  async function triggerEscalationDemo() {
    const runId = crypto.randomUUID();
    setLoading(true);
    setResponse(null);
    setActiveRunId(runId);
    setAgentFlow(defaultAgentFlow);
    const source = createEventSource(runId);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as AgentEvent;
      if (payload.agent !== 'System') {
        setAgentFlow((current) => current.map((item) => (item.agent === payload.agent ? { ...item, status: payload.status, message: payload.message, step: payload.step, confidence: payload.confidence ?? item.confidence ?? null } : item)));
      }
    };

    try {
      const result = await simulateEdgeCase({
        scenario: 'data_staleness',
        district,
        crop,
        language,
        run_id: runId,
      });
      setResponse(result);
      setLanguage(result.language);
      setAgentFlow((current) => current.map((item) => ({
        ...item,
        status: item.status === 'ERROR' ? 'ERROR' : 'COMPLETE',
      })));
      toast.success('Escalation demo ready');
    } catch {
      setAgentFlow((current) => current.map((item) => ({
        ...item,
        status: item.status === 'COMPLETE' ? 'COMPLETE' : 'ERROR',
        message: item.status === 'COMPLETE' ? item.message : 'Run did not complete for this agent.',
      })));
      toast.error('Escalation demo failed');
    } finally {
      setLoading(false);
      source.close();
    }
  }

  function loadSampleScenario() {
    setDistrict('Yavatmal');
    setCrop('Cotton');
    setLanguage('Auto');
    setQuery(getSampleQuery('Auto', 'Marathi'));
    setResponse(null);
    toast.success('Sample scenario loaded');
  }

  return (
    <div className='mx-auto flex min-h-full max-w-[1560px] flex-col gap-6 p-4 sm:p-6 lg:p-8'>
      <PageHeader
        eyebrow='Farmer Help'
        title='Multilingual Farmer Advisory'
        description='Farmers can type or speak their question, and the advisory is returned in the same language with local soil, NDVI, pest, and forecast context.'
      />

      <div className='grid gap-4 xl:grid-cols-3'>
        <StepCard number='1' title='Choose location' text='Select district, crop, and preferred language or keep auto detection.' />
        <StepCard number='2' title='Type or speak the query' text='Use the browser microphone when typing is difficult on mobile.' />
        <StepCard number='3' title='Get advisory' text='See soil, weather, reasoning, and the farmer-facing answer in the same language.' />
      </div>

      <section className='rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
        <div className='flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center'>
          <div className='min-w-0'>
            <p className='text-sm font-semibold text-text-main'>Smartphone multilingual demo</p>
            <p className='mt-1 max-w-3xl text-sm leading-6 text-text-muted'>The same farmer problem is shown side-by-side in English and Hindi, with live district-aware responses generated from the current district and crop selection.</p>
          </div>
          <button
            type='button'
            onClick={loadBilingualDemo}
            disabled={demoLoading}
            className='rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-text-main disabled:opacity-60'
          >
            {demoLoading ? 'Generating demo...' : 'Generate English + Hindi demo'}
          </button>
        </div>

        <div className='mt-5 grid gap-4 xl:grid-cols-2'>
          <PhonePreviewCard
            language='English'
            district={district}
            crop={crop}
            query={englishDemoQuery}
            response={demoResponses.English}
            loading={demoLoading}
          />
          <PhonePreviewCard
            language='Hindi'
            district={district}
            crop={crop}
            query={hindiDemoQuery}
            response={demoResponses.Hindi}
            loading={demoLoading}
          />
        </div>
      </section>

      <div className='grid min-h-0 gap-6 2xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]'>
        <section className='min-h-0 space-y-6'>
          <div className='rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
            <div className='flex flex-col items-start justify-between gap-3 sm:flex-row'>
              <div className='min-w-0'>
                <p className='text-sm font-semibold text-text-main'>Enter the farmer question</p>
                <p className='mt-1 text-sm leading-6 text-text-muted'>Text-only fallback is still available, but microphone capture now works directly in the browser.</p>
              </div>
              <button
                type='button'
                onClick={loadSampleScenario}
                className='rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-text-main'
              >
                Load sample
              </button>
            </div>

            <div className='mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4'>
              <SelectField label='District' value={district} onChange={setDistrict} options={(districtsData?.districts ?? []).map((item) => item.district)} />
              <SelectField label='Crop' value={crop} onChange={setCrop} options={['Cotton', 'Wheat', 'Rice', 'Soybean', 'Sugarcane', 'Moringa']} />
              <SelectField label='Language' value={language} onChange={setLanguage} options={languageOptions} />
              <ReadOnlyField label='State' value={currentDistrict?.state ?? 'Maharashtra'} />
            </div>

            <div className='mt-5 rounded-3xl border border-border bg-surface-2 p-4'>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <p className='text-sm font-semibold text-text-main'>Farmer query</p>
                  <p className='mt-1 text-sm text-text-muted'>Use Marathi, Hindi, Punjabi, English, or another supported language directly in text, or tap the mic to speak.</p>
                </div>
                <button
                  type='button'
                  onClick={isListening ? stopVoiceInput : startVoiceInput}
                  disabled={!voiceSupported}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${isListening ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/12 dark:text-red-200' : 'border-border bg-surface-1 text-text-main dark:bg-[rgba(17,35,24,0.92)] dark:text-white/90'}`}
                >
                  {isListening ? <Square size={15} /> : <Mic size={15} />}
                  {isListening ? 'Stop' : 'Voice input'}
                </button>
              </div>
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={5}
                className='mt-4 w-full resize-none rounded-[24px] border border-border bg-surface-1 px-4 py-3 text-[15px] leading-7 text-text-main shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:bg-[rgba(17,35,24,0.94)] dark:text-white/92 dark:shadow-none dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20'
                placeholder={sampleQuery}
              />
              <div className='mt-4 rounded-2xl border border-primary/15 bg-surface-1 p-4 dark:bg-[rgba(17,35,24,0.94)]'>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <p className='text-sm font-semibold text-text-main'>Simulated Marathi voice note</p>
                    <p className='mt-1 text-sm leading-6 text-text-muted'>Plays a Marathi sample in the browser, transcribes it into the query field, and runs the pipeline automatically.</p>
                  </div>
                  <button
                    type='button'
                    onClick={playSampleVoiceDemo}
                    disabled={loading || isPlayingSampleVoice}
                    className='inline-flex items-center justify-center gap-2 rounded-full border border-primary/20 bg-emerald-50 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-60 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200'
                  >
                    <Mic size={15} />
                    {isPlayingSampleVoice ? 'Playing sample...' : 'Play Marathi sample'}
                  </button>
                </div>
              </div>
              <p className='mt-3 text-xs text-text-muted dark:text-white/65'>
                {voiceSupported
                  ? `Mic language follows the selected language. Current voice locale: ${speechLanguageFor(language, currentDistrict?.state)}`
                  : 'Browser voice input is not supported here. Chrome and Android browsers work best.'}
              </p>
            </div>

            <div className='mt-5 grid gap-3 sm:grid-cols-2'>
              <button
                type='button'
                disabled={loading || !query.trim()}
                onClick={execute}
                className='inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-4 text-base font-semibold text-white disabled:opacity-60'
              >
                <Send size={16} />
                {loading ? 'Checking soil and weather...' : 'Get farmer advice'}
              </button>
              <button
                type='button'
                disabled={loading}
                onClick={triggerEscalationDemo}
                className='inline-flex w-full items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-5 py-4 text-base font-semibold text-amber-800 disabled:opacity-60'
              >
                <AlertTriangle size={16} />
                Trigger escalation demo
              </button>
            </div>

            <div className='mt-4 rounded-3xl border border-amber-200 bg-amber-50/80 p-4'>
              <p className='text-sm font-semibold text-amber-900'>Judge demo trigger</p>
              <p className='mt-1 text-sm leading-6 text-amber-800'>One click runs the real edge-case path and forces a visible refusal state through `/api/simulate-edge-case` so judges can see the escalation behavior, not just hear about it.</p>
            </div>
          </div>

          <div className='flex min-h-0 flex-col rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
            <p className='text-sm font-semibold text-text-main'>Live end-to-end agent run</p>
            <p className='mt-1 text-sm leading-6 text-text-muted'>A single `/api/farmer-query` call streams all four agent stages and returns the farmer answer, risk score, audit entry, and institutional report together.</p>
            <div className='mt-4 max-h-[23rem] space-y-3 overflow-auto pr-1'>
              {agentFlow.map((item) => (
                <AgentFlowCard key={item.agent} item={item} />
              ))}
            </div>
            <div className='mt-4 rounded-2xl border border-border bg-surface-2 p-4'>
              <p className='text-xs font-semibold uppercase tracking-[0.2em] text-text-muted'>Run ID</p>
              <p className='mt-2 break-all text-sm leading-6 text-text-main'>{activeRunId || 'A run ID appears here after submission.'}</p>
            </div>
          </div>
        </section>

        <section className='min-h-0 space-y-6'>
          <div className='grid min-h-0 items-stretch gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]'>
            <div className='flex min-h-[34rem] min-w-0 flex-col rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
              <p className='text-sm font-semibold text-text-main'>Farmer answer</p>
              {!response && (
                <div className='mt-5 rounded-3xl border border-dashed border-border bg-surface-2 p-6'>
                  <p className='text-lg font-semibold text-text-main'>The answer will appear here.</p>
                  <p className='mt-3 text-sm leading-7 text-text-muted'>
                    Ask by voice or text and FarmPulse will combine soil conditions, district stress signal, crop stage, and the 5-day forecast before returning a same-language recommendation.
                  </p>
                  <div className='mt-5 grid gap-3 sm:grid-cols-3'>
                    <MiniHint title='Language' text='Auto-detected or manually selected' />
                    <MiniHint title='Soil' text='Moisture, pH, nitrogen' />
                    <MiniHint title='Weather' text='5-day rainfall window' />
                  </div>
                </div>
              )}

              {response && (
                <div className='mt-5 flex-1 space-y-4 overflow-auto pr-1 min-w-0'>
                  {response.escalate ? (
                    <div className='min-w-0 rounded-3xl border border-amber-300 bg-[linear-gradient(135deg,#fff7ed,#fef3c7)] p-5 shadow-[0_10px_30px_rgba(245,158,11,0.14)]'>
                      <div className='flex items-start gap-3'>
                        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700'>
                          <AlertTriangle size={20} />
                        </div>
                        <div className='min-w-0'>
                          <p className='text-xs font-semibold uppercase tracking-[0.24em] text-amber-700'>Escalated to KVK agronomist</p>
                          <p className='mt-2 break-words text-lg font-semibold leading-8 text-amber-950 sm:text-xl'>Confidence below threshold ({response.confidence.toFixed(0)}%). No recommendation fabricated.</p>
                          <p className='mt-3 break-words text-sm leading-7 text-amber-900'>{response.escalationReason || response.advisoryWhatsapp}</p>
                          <p className='mt-3 text-sm font-medium text-amber-900'>KVK contact: {response.districtRecord.kvk_contact}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className='min-w-0 rounded-3xl border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#d1fae5)] p-5 shadow-[0_10px_30px_rgba(16,185,129,0.12)]'>
                      <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700'>Advisory delivered</p>
                        <p className='mt-2 break-words text-lg font-semibold leading-8 text-text-main sm:text-xl'>{response.advisorySms}</p>
                      </div>
                      <p className='mt-4 whitespace-pre-line break-words text-sm leading-7 text-text-muted'>{response.advisoryWhatsapp}</p>
                    </div>
                  )}

                  <div className='grid gap-4 md:grid-cols-2 2xl:grid-cols-4'>
                    <InfoCard icon={Droplets} label='Soil moisture' value={`${response.soilSnapshot.moisturePct}%`} helper={response.soilSnapshot.moistureBand} />
                    <InfoCard icon={Leaf} label='Nitrogen' value={`${response.soilSnapshot.nitrogenKgHa} kg/ha`} helper={response.cropStage} />
                    <InfoCard icon={Waves} label='Soil pH' value={`${response.soilSnapshot.soilPH}`} helper={response.soilSnapshot.summary} />
                    <InfoCard icon={CloudRain} label='Best weather window' value={bestDay ? bestDay.day : '--'} helper={bestDay ? `${bestDay.rainMm} mm rain expected` : 'Available after analysis'} />
                  </div>

                  <div className='rounded-3xl border border-border bg-background p-5'>
                    <p className='text-xs font-semibold uppercase tracking-[0.24em] text-text-muted'>Query used</p>
                    <p className='mt-2 break-words text-base leading-8 text-text-main'>{response.farmerQuery}</p>
                  </div>
                </div>
              )}
            </div>

            <div className='flex min-h-[34rem] min-w-0 flex-col rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
              <p className='text-sm font-semibold text-text-main'>5-day weather</p>
              <p className='mt-1 text-sm text-text-muted'>A drier day is usually safer for fertilizer application.</p>
              <div className='mt-4 flex-1 space-y-3 overflow-auto pr-1'>
                {(response?.forecast5d ?? []).map((day) => (
                  <ForecastRow key={day.date} day={day} highlight={bestDay?.date === day.date} />
                ))}
                {!response && <div className='rounded-2xl border border-dashed border-border bg-surface-2 p-4 text-sm text-text-muted'>Forecast will appear after analysis.</div>}
              </div>
            </div>
          </div>

          {response && (
            <div className='grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]'>
              <div className='flex min-h-[34rem] min-w-0 flex-col rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
                <p className='text-sm font-semibold text-text-main'>Why the agent suggested this</p>
                <div className='mt-4 flex-1 space-y-3 overflow-auto pr-1'>
                  {response.reasoningChain.map((item, index) => (
                    <div key={`${item.title}-${index}`} className='rounded-2xl border border-border bg-surface-2 p-4'>
                      <p className='text-sm font-semibold text-text-main'>Step {index + 1}: {item.title}</p>
                      <p className='mt-1 text-sm leading-6 text-text-muted'>{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className='flex min-h-[34rem] min-w-0 flex-col rounded-[28px] border border-border bg-surface-1 p-6 shadow-[0_18px_45px_rgba(20,44,31,0.08)]'>
                <p className='text-sm font-semibold text-text-main'>Returned in one API call</p>
                <div className='mt-4 flex-1 space-y-3 overflow-auto pr-1'>
                  <SummaryRow label='SMS advisory' value={response.advisorySms} />
                  <SummaryRow label='Risk score' value={`${response.riskReport.riskScore}/100 • ${response.riskReport.riskCategory}`} />
                  <SummaryRow label='Confidence' value={`${response.confidence.toFixed(0)}%`} />
                  <SummaryRow label='Model route' value={`${displayModelName(response.modelUsed)} for farmer advisory • Sonnet for institutional report`} />
                  <SummaryRow label='Institutional report' value={response.advisoryInstitutional} />
                  <SummaryRow label='Recommended action' value={response.riskReport.recommendedAction} />
                  <SummaryRow label='Data sources' value={response.dataSources.join(' • ')} />
                  <SummaryRow label='Warnings' value={response.warnings.join(' | ') || 'None'} />
                  <AuditLinkCard runId={response.runId} />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function displayModelName(model: string) {
  if (model === 'farmer-advisory-engine') return 'Haiku';
  if (model === 'institutional-analysis-engine') return 'Sonnet';
  return model;
}

function selectBestDay(days: ForecastDay[]) {
  if (!days.length) {
    return null;
  }
  return [...days].sort((a, b) => a.rainMm - b.rainMm || a.maxTempC - b.maxTempC)[0];
}

function StepCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className='rounded-[24px] border border-border bg-surface-1 p-5 shadow-[0_14px_34px_rgba(20,44,31,0.07)]'>
      <div className='flex items-center gap-3'>
        <div className='flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white'>{number}</div>
        <p className='text-base font-semibold text-text-main'>{title}</p>
      </div>
      <p className='mt-3 break-words text-sm leading-6 text-text-muted'>{text}</p>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className='block'>
      <span className='text-xs font-semibold uppercase tracking-[0.24em] text-text-muted'>{label}</span>
      <div className='mt-2 relative'>
        <select value={value} onChange={(event) => onChange(event.target.value)} className='w-full appearance-none rounded-[22px] border border-border bg-surface-1 px-4 py-3 pr-10 text-sm font-medium text-text-main shadow-[0_8px_20px_rgba(15,23,42,0.05)] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:bg-[rgba(17,35,24,0.94)] dark:text-white/92 dark:shadow-none dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20'>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <div className='pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400 dark:text-white/55'>
          <span className='text-xs'>▼</span>
        </div>
      </div>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className='text-xs font-semibold uppercase tracking-[0.24em] text-text-muted'>{label}</span>
      <div className='mt-2 rounded-[22px] border border-border bg-surface-1 px-4 py-3 text-sm font-medium text-text-main shadow-[0_8px_20px_rgba(15,23,42,0.05)] dark:bg-[rgba(17,35,24,0.94)] dark:text-white/92 dark:shadow-none'>{value}</div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, helper }: { icon: typeof Droplets; label: string; value: string; helper: string }) {
  return (
    <div className='min-w-0 rounded-2xl border border-border bg-surface-2 p-4'>
      <div className='flex items-center justify-between gap-3'>
        <p className='text-xs font-semibold uppercase tracking-[0.2em] text-text-muted'>{label}</p>
        <Icon size={16} className='text-primary' />
      </div>
      <p className='mt-3 break-words text-lg font-semibold text-text-main'>{value}</p>
      <p className='mt-1 break-words text-sm leading-6 text-text-muted'>{helper}</p>
    </div>
  );
}

function ForecastRow({ day, highlight }: { day: ForecastDay; highlight: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${highlight ? 'border-primary/40 bg-emerald-50' : 'border-border bg-surface-2'}`}>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-text-main'>{day.day}</p>
          <p className='text-xs text-text-muted'>{new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
        </div>
        <div className='text-right'>
          <p className='text-sm font-semibold text-text-main'>{day.rainMm} mm</p>
          <p className='text-xs text-text-muted'>{day.minTempC}° / {day.maxTempC}°C</p>
        </div>
      </div>
      <p className='mt-2 text-xs text-text-muted'>{highlight ? 'Best available application window' : day.outlook}</p>
    </div>
  );
}

function MiniHint({ title, text }: { title: string; text: string }) {
  return (
    <div className='min-w-0 rounded-2xl border border-border bg-background p-4'>
      <p className='text-sm font-semibold text-text-main'>{title}</p>
      <p className='mt-1 break-words text-sm leading-6 text-text-muted'>{text}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 rounded-2xl border border-border bg-surface-2 p-4'>
      <p className='text-xs font-semibold uppercase tracking-[0.2em] text-text-muted'>{label}</p>
      <p className='mt-2 break-words text-sm leading-7 text-text-main'>{value}</p>
    </div>
  );
}

function AgentFlowCard({ item }: { item: AgentFlowStep }) {
  const tone = item.status === 'COMPLETE' ? 'border-emerald-200 bg-emerald-50' : item.status === 'RUNNING' ? 'border-amber-200 bg-amber-50' : item.status === 'ERROR' ? 'border-red-200 bg-red-50' : 'border-border bg-surface-2';
  const badge = item.status === 'COMPLETE' ? 'text-emerald-700' : item.status === 'RUNNING' ? 'text-amber-700' : item.status === 'ERROR' ? 'text-red-700' : 'text-text-muted';

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-text-main'>{item.title}</p>
          <p className='mt-1 text-xs uppercase tracking-[0.18em] text-text-muted'>{item.agent}</p>
        </div>
        <div className='flex flex-col items-end gap-2'>
          <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${badge}`}>{item.status}</span>
          <span className='rounded-full border border-border bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-text-main'>
            {item.confidence != null ? `Confidence ${Math.round(item.confidence)}%` : 'Confidence pending'}
          </span>
        </div>
      </div>
      <p className='mt-2 text-sm leading-6 text-text-muted'>{item.message}</p>
    </div>
  );
}

function AuditLinkCard({ runId }: { runId: string }) {
  return (
    <div className='rounded-2xl border border-primary/20 bg-emerald-50/70 p-4'>
      <p className='text-xs font-semibold uppercase tracking-[0.2em] text-text-muted'>Audit entry</p>
      <p className='mt-2 break-all text-sm leading-6 text-text-main'>{runId}</p>
      <Link
        to={`/audit?runId=${runId}`}
        className='mt-3 inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white'
      >
        Open audit trace
      </Link>
    </div>
  );
}

function PhonePreviewCard({
  language,
  district,
  crop,
  query,
  response,
  loading,
}: {
  language: string;
  district: string;
  crop: string;
  query: string;
  response: AnalysisResponse | null;
  loading: boolean;
}) {
  return (
    <div className='rounded-[28px] border border-border bg-background p-4'>
      <div className='mx-auto w-[300px] rounded-[38px] bg-slate-950 p-[9px] shadow-[0_24px_60px_rgba(15,23,42,0.24)]'>
        <div className='overflow-hidden rounded-[30px] border border-slate-800 bg-white'>
          <div className='flex items-center justify-between bg-slate-950 px-5 py-3 text-[11px] font-medium text-white'>
            <span>9:41</span>
            <div className='h-5 w-28 rounded-full bg-black/70' />
            <span>5G</span>
          </div>
          <div className='border-b border-slate-200 bg-white px-4 py-3'>
            <p className='text-sm font-semibold text-slate-900'>{language} farmer view</p>
            <p className='text-xs text-slate-500'>{district} • {crop}</p>
          </div>
          <div className='flex min-h-[470px] flex-col justify-between bg-[linear-gradient(180deg,#f8fafc_0%,#eef6f1_100%)] p-3'>
            <div className='space-y-3 min-w-0'>
              <div className='ml-auto max-w-[84%] break-words rounded-[20px] rounded-tr-md bg-emerald-600 px-3.5 py-2.5 text-[13px] leading-5 text-white shadow-sm'>
                {query}
              </div>
              <div className='max-w-[90%] break-words rounded-[20px] rounded-tl-md bg-white px-3.5 py-2.5 text-[13px] leading-5 text-slate-800 shadow-sm'>
                {loading ? 'Generating district-aware answer...' : response?.advisoryWhatsapp ?? 'Tap the demo button to generate a live answer for this district.'}
              </div>
            </div>
            <div className='space-y-2.5'>
              <div className='rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-[11px] leading-4.5 text-slate-600'>
                {response ? `Confidence ${response.confidence.toFixed(0)}% • ${response.riskReport.rootCause}` : 'The response updates with the selected district and crop, so the advice changes when local weather, soil, and pest conditions change.'}
              </div>
              <div className='mx-auto h-1.5 w-28 rounded-full bg-slate-300' />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
