import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileSearch,
  Globe2,
  Languages,
  LoaderCircle,
  Menu,
  Network,
  Play,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type {
  AgentEvent,
  Lane,
  RunRequest,
  RunResponse,
  Signal,
  SourceType,
} from "../shared/contracts";
import { createRun } from "./api";

type Language = RunRequest["language"];
type Mode = RunRequest["mode"];

interface SavedInterest {
  id: string;
  text: string;
  freshnessHours: number;
  lastRunAt: string;
}

const EXAMPLES = [
  "OpenAI Agents SDK와 GPT-5.6의 새로운 발표",
  "서울 AI 스타트업 투자와 정부 지원 소식",
  "전 세계 휴머노이드 로봇 신제품과 실제 데모",
];

const LANE_META: Record<Lane, { short: string; color: string }> = {
  official: { short: "공식", color: "violet" },
  breaking: { short: "속보", color: "blue" },
  social: { short: "소셜", color: "pink" },
  video: { short: "영상", color: "orange" },
  community: { short: "커뮤니티", color: "green" },
  korea: { short: "한국", color: "cyan" },
};

const SOURCE_LABELS: Record<SourceType, string> = {
  official: "Official",
  news: "News",
  x: "X",
  youtube: "YouTube",
  reddit: "Reddit",
  instagram: "Instagram",
  tiktok: "TikTok",
  threads: "Threads",
  bluesky: "Bluesky",
  facebook: "Facebook",
  mastodon: "Mastodon",
  naver: "Naver",
  community: "Community",
  web: "Web",
};

function readSavedInterests(): SavedInterest[] {
  try {
    const value = JSON.parse(localStorage.getItem("keyp.savedInterests") ?? "[]") as unknown;
    return Array.isArray(value) ? (value as SavedInterest[]).slice(0, 6) : [];
  } catch {
    return [];
  }
}

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
}

function timeAgo(value: string, language: Language): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return language === "ko" ? "방금 전" : "just now";
  if (minutes < 60) return language === "ko" ? `${minutes}분 전` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return language === "ko" ? `${hours}시간 전` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return language === "ko" ? `${days}일 전` : `${days}d ago`;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="KeyP">
      <div className="brand-mark"><span>K</span><i /></div>
      {!compact && <span className="brand-name">KeyP</span>}
    </div>
  );
}

function SideNav({
  open,
  onClose,
  saved,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  saved: SavedInterest[];
  onSelect: (item: SavedInterest) => void;
}) {
  return (
    <>
      <button className={`nav-scrim ${open ? "visible" : ""}`} onClick={onClose} aria-label="메뉴 닫기" />
      <aside className={`side-nav ${open ? "open" : ""}`}>
        <div className="side-head">
          <Logo />
          <button className="icon-button close-nav" onClick={onClose} aria-label="메뉴 닫기"><X size={20} /></button>
        </div>
        <nav className="primary-nav" aria-label="주 메뉴">
          <a className="active" href="#command"><Radio size={18} /> Signal desk</a>
          <a href="#agents"><Network size={18} /> Agent swarm</a>
          <a href="#sources"><Globe2 size={18} /> Source map</a>
        </nav>
        <div className="saved-block">
          <div className="eyebrow-row"><span>RECENT INTERESTS</span><span>{saved.length}</span></div>
          {saved.length === 0 ? (
            <p className="saved-empty">첫 관심사를 실행하면 이 기기에만 안전하게 저장됩니다.</p>
          ) : (
            saved.map((item) => (
              <button key={item.id} className="saved-item" onClick={() => onSelect(item)}>
                <span className="saved-icon"><Target size={14} /></span>
                <span><b>{item.text}</b><small>{timeAgo(item.lastRunAt, "ko")}</small></span>
                <ChevronRight size={15} />
              </button>
            ))
          )}
        </div>
        <div className="side-foot">
          <div className="privacy-note"><ShieldCheck size={17} /><span><b>Privacy-first</b><small>공개 웹만 탐색합니다</small></span></div>
          <span className="version">BUILDWEEK · v0.1</span>
        </div>
      </aside>
    </>
  );
}

function CommandBar({
  interest,
  setInterest,
  mode,
  freshness,
  setFreshness,
  running,
  onRun,
}: {
  interest: string;
  setInterest: (value: string) => void;
  mode: Mode;
  freshness: number;
  setFreshness: (value: number) => void;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <section className="command-card" id="command">
      <div className="command-glow" />
      <div className="command-kicker"><Sparkles size={15} /> ONE INTEREST. A SWARM OF SPECIALISTS.</div>
      <h1>검색하기 전에,<br /><span>무엇이 중요한지</span> 먼저 압니다.</h1>
      <p className="hero-copy">관심사 하나를 6개의 탐색 임무로 분해하고, 4명의 독립 판정 에이전트가 출처·관련성·신선도·새로움을 교차 검증합니다.</p>
      <div className="composer">
        <div className="composer-input">
          <Search size={21} />
          <textarea
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onRun();
            }}
            maxLength={600}
            rows={2}
            placeholder="예: 삼성의 차세대 XR 기기 출시 신호를 공식 발표와 해외 커뮤니티까지 추적해줘"
            aria-label="관심사"
          />
          <button className="run-button" disabled={running || interest.trim().length < 3} onClick={onRun}>
            {running ? <LoaderCircle className="spin" size={19} /> : <Play size={17} fill="currentColor" />}
            {running ? "탐색 중" : mode === "live" ? "Live 탐색" : "Demo 실행"}
          </button>
        </div>
        <div className="composer-footer">
          <span><kbd>⌘</kbd><kbd>↵</kbd> 실행</span>
          <label><Clock3 size={14} /> 탐색 범위
            <select value={freshness} onChange={(event) => setFreshness(Number(event.target.value))}>
              <option value={24}>최근 24시간</option>
              <option value={72}>최근 3일</option>
              <option value={168}>최근 7일</option>
              <option value={720}>최근 30일</option>
            </select>
          </label>
        </div>
      </div>
      <div className="example-row">
        <span>바로 시작하기</span>
        {EXAMPLES.map((example) => <button key={example} onClick={() => setInterest(example)}>{example}<ArrowUpRight size={13} /></button>)}
      </div>
    </section>
  );
}

function LoadingSwarm() {
  const labels = ["의도 구조화", "공식 출처", "속보", "소셜", "영상", "커뮤니티", "한국", "근거 검증", "4중 판정", "브리핑"];
  return (
    <section className="loading-card" aria-live="polite">
      <div className="radar"><span /><span /><span /><Bot size={25} /></div>
      <div><span className="section-kicker">GPT-5.6 SWARM IS WORKING</span><h2>전문 에이전트가 병렬로 신호를 좁히고 있습니다</h2><p>공개 웹을 탐색한 뒤 URL 접근성, 중복, 시간 범위를 먼저 검증합니다.</p></div>
      <div className="loading-agents">
        {labels.map((label, index) => <span key={label} style={{ animationDelay: `${index * 120}ms` }}><i />{label}</span>)}
      </div>
    </section>
  );
}

function Metrics({ result }: { result: RunResponse }) {
  const items = [
    { label: "탐색 레인", value: result.metrics.laneCount, suffix: "개", icon: Network },
    { label: "발견 후보", value: result.metrics.candidateCount, suffix: "개", icon: FileSearch },
    { label: "검증 신호", value: result.metrics.verifiedCount, suffix: "개", icon: BadgeCheck },
    { label: "병렬 가속", value: result.metrics.parallelSpeedup, suffix: "×", icon: Zap },
  ];
  return (
    <div className="metric-grid">
      {items.map((item) => <div className="metric" key={item.label}><item.icon size={17} /><span>{item.label}</span><strong>{item.value}<small>{item.suffix}</small></strong></div>)}
    </div>
  );
}

function AgentMesh({ result }: { result: RunResponse }) {
  const scouts = result.events.filter((event) => event.role === "scout");
  const judges = result.events.filter((event) => event.role === "judge");
  const manager = result.events.find((event) => event.role === "manager");
  const editor = result.events.find((event) => event.role === "editor");
  return (
    <section className="panel agent-panel" id="agents">
      <div className="panel-heading">
        <div><span className="section-kicker">PARALLEL ORCHESTRATION</span><h2>12-agent signal swarm</h2></div>
        <div className="live-pill"><i /> COMPLETED · {formatDuration(result.metrics.wallClockMs)}</div>
      </div>
      <div className="mesh-flow">
        {manager && <AgentNode event={manager} type="manager" />}
        <span className="flow-arrow"><ChevronRight /></span>
        <div className="scout-grid">{scouts.map((event) => <AgentNode key={event.id} event={event} type="scout" />)}</div>
        <span className="flow-arrow"><ChevronRight /></span>
        <div className="judge-stack">{judges.map((event) => <AgentNode key={event.id} event={event} type="judge" />)}</div>
        <span className="flow-arrow"><ChevronRight /></span>
        {editor && <AgentNode event={editor} type="editor" />}
      </div>
      <div className="agent-foot"><ShieldCheck size={15} /> <span>확정적 게이트가 사설 URL·중복·오래된 신호를 AI 판정 전에 제거했습니다.</span><b>순차 예상 {formatDuration(result.metrics.estimatedSequentialMs)}</b></div>
    </section>
  );
}

function AgentNode({ event, type }: { event: AgentEvent; type: "manager" | "scout" | "judge" | "editor" }) {
  const Icon = type === "manager" ? Target : type === "editor" ? BellRing : type === "judge" ? ShieldCheck : Radio;
  return (
    <div className={`agent-node ${type} status-${event.status}`} title={event.detail}>
      <span className="agent-icon"><Icon size={type === "scout" ? 13 : 17} /></span>
      <span><b>{event.name}</b><small>{formatDuration(event.durationMs)}</small></span>
      <Check className="node-check" size={13} />
    </div>
  );
}

function SignalCard({ signal, index, language }: { signal: Signal; index: number; language: Language }) {
  const date = signal.eventAt ?? signal.publishedAt;
  return (
    <motion.article className="signal-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
      <div className="signal-top">
        <span className={`source-badge source-${signal.sourceType}`}>{SOURCE_LABELS[signal.sourceType]}</span>
        <span className="lane-badge">{LANE_META[signal.lane].short}</span>
        {date && <span className="signal-time"><Clock3 size={13} /> {timeAgo(date, language)}</span>}
        <span className="confidence"><i style={{ "--score": `${signal.confidence}%` } as CSSProperties} /> {signal.confidence}% confidence</span>
      </div>
      <h3>{signal.title}</h3>
      <p>{signal.summary}</p>
      <div className="why"><Sparkles size={15} /><span><b>왜 중요한가</b>{signal.whyItMatters}</span></div>
      <div className="signal-bottom">
        <div className="tags">{signal.tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <a href={signal.url} target="_blank" rel="noreferrer">{signal.sourceName}<ExternalLink size={14} /></a>
      </div>
    </motion.article>
  );
}

function SourceMap({ result }: { result: RunResponse }) {
  return (
    <section className="panel source-panel" id="sources">
      <div className="panel-heading"><div><span className="section-kicker">SEARCH PLAN</span><h2>6개의 전문 탐색 레인</h2></div><span className="coverage-count">{result.metrics.sourceCoverage.length} source types verified</span></div>
      <div className="lane-grid">
        {result.plan.lanes.map((lane, index) => {
          const event = result.events.find((item) => item.id === `scout-${lane.lane}`);
          return <div className={`lane-card lane-${LANE_META[lane.lane].color}`} key={lane.lane}><div><span className="lane-index">0{index + 1}</span><i /></div><h3>{LANE_META[lane.lane].short}</h3><p>{lane.query}</p><div className="target-row">{lane.targets.slice(0, 3).map((target) => <span key={target}>{target}</span>)}</div><small><Check size={12} /> {event?.detail ?? "완료"}</small></div>;
        })}
      </div>
    </section>
  );
}

function Results({ result, language }: { result: RunResponse; language: Language }) {
  return (
    <motion.div className="result-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <section className="result-hero">
        <div><span className="section-kicker"><i /> {result.mode === "live" ? "LIVE PUBLIC WEB" : "SAFE DEMO DATA"} · {result.model}</span><h2>{result.headline}</h2><p>{result.briefing}</p></div>
        <div className="generated"><span>GENERATED</span><b>{new Date(result.generatedAt).toLocaleTimeString(language === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</b><small>{result.runId}</small></div>
      </section>
      <Metrics result={result} />
      <AgentMesh result={result} />
      <section className="signals-section">
        <div className="panel-heading"><div><span className="section-kicker">VERIFIED SIGNALS</span><h2>잡음보다 먼저 도착한 신호</h2></div><span className="selected-count">{result.signals.length} selected</span></div>
        {result.signals.length ? <div className="signal-list">{result.signals.map((signal, index) => <SignalCard signal={signal} index={index} language={language} key={signal.id} />)}</div> : <div className="no-signals"><ShieldCheck size={26} /><h3>지금은 전달할 만큼 강한 신호가 없습니다</h3><p>KeyP는 빈 결과를 허용합니다. 범위를 넓히거나 나중에 다시 실행해 보세요.</p></div>}
      </section>
      <SourceMap result={result} />
    </motion.div>
  );
}

export function App() {
  const [interest, setInterest] = useState("");
  const [language, setLanguage] = useState<Language>("ko");
  const [mode, setMode] = useState<Mode>("demo");
  const [freshness, setFreshness] = useState(72);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedInterest[]>(readSavedInterests);
  const [navOpen, setNavOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => localStorage.setItem("keyp.savedInterests", JSON.stringify(saved)), [saved]);

  const knownUrls = useMemo(() => result?.signals.map((signal) => signal.url) ?? [], [result]);

  async function handleRun() {
    const text = interest.trim();
    if (text.length < 3 || running) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setRunning(true);
    setError(null);
    try {
      const next = await createRun({ interest: text, language, freshnessHours: freshness, mode, knownUrls }, controller.current.signal);
      setResult(next);
      setSaved((current) => [
        { id: crypto.randomUUID(), text, freshnessHours: freshness, lastRunAt: new Date().toISOString() },
        ...current.filter((item) => item.text !== text),
      ].slice(0, 6));
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (runError) {
      if (runError instanceof DOMException && runError.name === "AbortError") return;
      setError(runError instanceof Error ? runError.message : "탐색을 완료하지 못했습니다.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="app-shell">
      <SideNav open={navOpen} onClose={() => setNavOpen(false)} saved={saved} onSelect={(item) => { setInterest(item.text); setFreshness(item.freshnessHours); setNavOpen(false); }} />
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setNavOpen(true)} aria-label="메뉴 열기"><Menu size={20} /></button>
          <div className="mobile-logo"><Logo /></div>
          <div className="status"><span className="status-dot" /> All systems operational</div>
          <div className="top-controls">
            <div className="mode-toggle" aria-label="탐색 모드">
              <button className={mode === "demo" ? "active" : ""} onClick={() => setMode("demo")}>Demo</button>
              <button className={mode === "live" ? "active live" : ""} onClick={() => setMode("live")}><i /> Live</button>
            </div>
            <button className="language-button" onClick={() => setLanguage((value) => value === "ko" ? "en" : "ko")}><Languages size={16} /> {language === "ko" ? "KO" : "EN"}</button>
            <button className="icon-button" aria-label="설정"><Settings2 size={18} /></button>
          </div>
        </header>
        <div className="content-wrap">
          <CommandBar interest={interest} setInterest={setInterest} mode={mode} freshness={freshness} setFreshness={setFreshness} running={running} onRun={handleRun} />
          <AnimatePresence>{error && <motion.div className="error-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><span><Activity size={18} /><b>탐색을 완료하지 못했습니다.</b> {error}</span><button onClick={() => setError(null)}><X size={17} /></button></motion.div>}</AnimatePresence>
          <div id="results">{running ? <LoadingSwarm /> : result ? <Results result={result} language={language} /> : <section className="trust-strip"><div><Network size={20} /><span><b>Parallel by design</b>6 scouts, 4 judges</span></div><div><ShieldCheck size={20} /><span><b>Evidence before prose</b>URL & freshness gates</span></div><div><Globe2 size={20} /><span><b>Public web only</b>No private scraping</span></div><div><Zap size={20} /><span><b>OpenAI powered</b>GPT-5.6 + Agents SDK</span></div></section>}</div>
        </div>
        <footer><Logo compact /><span>KeyP turns one interest into an evidence-backed signal desk.</span><a href="https://github.com/openai/openai-agents-js" target="_blank" rel="noreferrer">OpenAI Agents SDK <ExternalLink size={13} /></a></footer>
      </main>
    </div>
  );
}
