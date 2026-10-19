"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ArrowDownToLine, BarChart3, CheckCircle2, Database, ExternalLink, Menu, Search, SlidersHorizontal, X } from "lucide-react";
import { DramRecord, Metric, compactUnits, compactUsd, downloadCsv, formatPct, lagCorrelation, metricMeta, pct, shapley, transform } from "@/lib/analysis";

type Payload = {
  meta: { source: string; hsk: string; unit: string };
  validation: Record<string, unknown>;
  records: DramRecord[];
};

const presets = [
  ["전체", 999], ["15년", 180], ["10년", 120], ["5년", 60], ["3년", 36], ["1년", 12],
] as const;

const formatAxis = (value: number, metric: Metric, mode: string) => {
  if (mode === "yoy") return `${value.toFixed(0)}%`;
  if (mode === "index") return value.toFixed(0);
  if (metric === "export_usd") return `${(value / 1e9).toFixed(0)}B`;
  if (metric === "export_units") return `${(value / 1e8).toFixed(0)}억`;
  return `$${value.toFixed(0)}`;
};

const chartLabel = (metric: Metric, mode: string) => mode === "yoy" ? "전년 동월 대비" : mode === "index" ? "선택 기간 시작=100" : metricMeta[metric].label;

function SectionTitle({ number, eyebrow, title, copy }: { number: string; eyebrow: string; title: string; copy?: string }) {
  return <div className="section-heading"><div className="section-number">{number}</div><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{copy && <p className="section-copy">{copy}</p>}</div></div>;
}

function StatCard({ label, value, delta, color }: { label: string; value: string; delta: number | null; color: string }) {
  return <article className="stat-card" style={{ "--accent": color } as React.CSSProperties}><div className="stat-top"><span>{label}</span><span className="pulse" /></div><strong>{value}</strong><div className={`delta ${(delta ?? 0) >= 0 ? "up" : "down"}`}>{formatPct(delta)} <small>전년 동월 대비</small></div></article>;
}

function MiniTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><b>{label}</b>{payload.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<em>{Number(item.value).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}</em></span>)}</div>;
}

function DataChart({ data, metric, mode, logScale, onHover }: { data: Array<Record<string, number | string | null>>; metric: Metric; mode: string; logScale: boolean; onHover: (ym?: string) => void }) {
  const color = metricMeta[metric].color;
  return <div className="chart-panel"><div className="chart-title"><div><i style={{ background: color }} />{metricMeta[metric].label}</div><span>{chartLabel(metric, mode)}</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} onMouseMove={(state) => onHover(state?.activeLabel as string)} onMouseLeave={() => onHover(undefined)} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}><CartesianGrid stroke="#d9e0e8" strokeDasharray="2 6" vertical={false} /><XAxis dataKey="ym" minTickGap={52} tickFormatter={(v) => String(v).slice(0, 4)} tick={{ fill: "#75808e", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis scale={logScale && mode === "level" ? "log" : "auto"} domain={logScale && mode === "level" ? ["auto", "auto"] : ["auto", "auto"]} tickFormatter={(v) => formatAxis(v, metric, mode)} tick={{ fill: "#75808e", fontSize: 11 }} axisLine={false} tickLine={false} width={52} /><Tooltip content={<MiniTooltip />} /><Line type="monotone" dataKey={metric} name={metricMeta[metric].short} stroke={color} strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: color, stroke: "white", strokeWidth: 2 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></div>;
}

export default function DramCycleDashboard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [range, setRange] = useState(999);
  const [mode, setMode] = useState<"level" | "yoy" | "index">("level");
  const [windowSize, setWindowSize] = useState(1);
  const [logScale, setLogScale] = useState(false);
  const [hovered, setHovered] = useState<string>();
  const [from, setFrom] = useState("2025-09");
  const [to, setTo] = useState("2026-09");
  const [cycleMetric, setCycleMetric] = useState<Metric>("usd_per_unit");
  const [lag, setLag] = useState(0);
  const [search, setSearch] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch("/data/dram-data.json").then((r) => r.json()).then((data) => setPayload(data as Payload)); }, []);
  const records = payload?.records ?? [];
  const latest = records.at(-1);
  const visible = useMemo(() => range >= records.length ? records : records.slice(-range), [records, range]);
  const chartData = useMemo(() => visible.map((row, index) => ({ ym: row.ym, export_usd: transform(visible, "export_usd", mode, windowSize)[index], export_units: transform(visible, "export_units", mode, windowSize)[index], usd_per_unit: transform(visible, "usd_per_unit", mode, windowSize)[index] })), [visible, mode, windowSize]);
  const active = records.find((r) => r.ym === hovered) ?? latest;
  const a = records.find((r) => r.ym === from);
  const b = records.find((r) => r.ym === to);
  const dec = a && b ? shapley(a, b) : null;
  const lagResult = useMemo(() => lagCorrelation(records, lag), [records, lag]);

  const cycleData = useMemo(() => {
    const starts = [{ key: "2017–18", start: "2017-01", end: "2018-12" }, { key: "2021–22", start: "2021-01", end: "2022-12" }, { key: "2024–26", start: "2024-01", end: "2026-09" }];
    const output: Array<Record<string, number>> = [];
    starts.forEach(({ key, start, end }) => {
      const slice = records.filter((r) => r.ym >= start && r.ym <= end);
      const base = slice[0]?.[cycleMetric] || 1;
      slice.forEach((r, i) => { output[i] ??= { month: i }; output[i][key] = r[cycleMetric] / base * 100; });
    });
    return output;
  }, [records, cycleMetric]);

  const recordsByMetric = useMemo(() => {
    if (!records.length) return [];
    const specs: Array<[string, (r: DramRecord) => number | null, "max" | "min", string]> = [
      ["평균 단위가치 최고", r => r.usd_per_unit, "max", "$"], ["평균 단위가치 최저", r => r.usd_per_unit, "min", "$"],
      ["월간 수출금액 최고", r => r.export_usd, "max", "usd"], ["월간 수출금액 최저", r => r.export_usd, "min", "usd"],
      ["신고수량 최고", r => r.export_units, "max", "unit"], ["가격 상승률 최대", r => r.avg_value_yoy_pct, "max", "%"],
      ["가격 하락률 최대", r => r.avg_value_yoy_pct, "min", "%"], ["수출액 증가율 최대", r => r.export_yoy_pct, "max", "%"],
    ];
    return specs.map(([label, getter, direction, unit]) => {
      const valid = records.filter(r => getter(r) != null);
      const row = valid.reduce((best, cur) => direction === "max" ? getter(cur)! > getter(best)! ? cur : best : getter(cur)! < getter(best)! ? cur : best);
      const value = getter(row)!;
      const display = unit === "usd" ? compactUsd(value) : unit === "unit" ? compactUnits(value) : unit === "%" ? formatPct(value) : `$${value.toFixed(2)}`;
      return { label, ym: row.ym, display };
    });
  }, [records]);

  const tableRows = useMemo(() => records.filter((r) => r.ym.includes(search)).slice().reverse().slice(0, 36), [records, search]);
  if (!payload || !latest) return <div className="loading"><span />237개월의 통관데이터를 불러오는 중…</div>;

  const currentUnitYoy = latest.avg_value_yoy_pct;
  const comparison = records.find((r) => r.ym === "2025-09")!;
  const amountRatio = latest.export_usd / comparison.export_usd;
  const barData = dec ? [{ name: "단가 요인", value: dec.price }, { name: "수량 요인", value: dec.quantity }] : [];
  const scatterData = lagResult.pairs.map(([price, units]) => ({ price, units }));

  const saveChart = () => {
    const svg = storyRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "dram-cycle-chart.svg"; a.click(); URL.revokeObjectURL(url);
  };

  return <main>
    <header className="topbar"><a className="brand" href="#top"><span>DRAM</span> CYCLE</a><nav className={mobileNav ? "open" : ""}>{[["지금", "now"], ["20년", "history"], ["요인 분해", "drivers"], ["사이클", "cycles"], ["관계", "relation"], ["기록", "records"], ["실험실", "lab"], ["방법론", "method"]].map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setMobileNav(false)}>{label}</a>)}<button className="nav-close" onClick={() => setMobileNav(false)}><X /></button></nav><button className="menu" onClick={() => setMobileNav(true)}><Menu /></button></header>

    <section id="top" className="hero"><div className="hero-grid" /><div className="hero-inner"><div className="hero-kicker"><span>20 YEARS OF KOREA&apos;S DRAM EXPORTS</span><span>2007.01 — 2026.09</span></div><h1>반도체는 더 많이 팔린 걸까,<br /><em>더 비싸게 팔린 걸까?</em></h1><p>237개월의 통관데이터로 추적한 한국 D램 수출의 가격과 수량, 그리고 슈퍼사이클의 역사</p><div className="hero-facts"><div><b>237</b><span>개월 관측치</span></div><div><b>6.3×</b><span>1년 새 수출액</span></div><div><b>98.96%</b><span>단가 요인 기여율</span></div></div><a className="scroll-cue" href="#now">데이터로 내려가기 <span>↓</span></a></div></section>

    <section id="now" className="section pale"><div className="container"><SectionTitle number="01" eyebrow="THE LATEST" title="지금의 D램" copy="2026년 9월, 수출액 급증의 대부분은 신고수량보다 평균 단위가치 변화에서 나왔습니다." /><div className="asof"><span>최신 데이터</span> 2026년 9월 · HSK 8542321010</div><div className="stats"><StatCard label="수출금액" value={compactUsd(latest.export_usd)} delta={latest.export_yoy_pct} color="#2f6df6" /><StatCard label="신고수량" value={compactUnits(latest.export_units)} delta={latest.units_yoy_pct} color="#16a36a" /><StatCard label="평균 단위가치" value={`$${latest.usd_per_unit.toFixed(2)}`} delta={currentUnitYoy} color="#f08a24" /></div><div className="comparison-card"><div><p className="eyebrow">SEPTEMBER TO SEPTEMBER</p><h3>수출액은 <em>{amountRatio.toFixed(1)}배</em>,<br />신고수량은 <em>{formatPct(latest.units_yoy_pct)}</em></h3><p>같은 기간 평균 단위가치는 {formatPct(currentUnitYoy)} 올랐습니다. 제품 구성 변화가 포함된 통관 평균값이므로 개별 제품 가격과 같지는 않습니다.</p></div><div className="compare-bars">{[["수출금액", comparison.export_usd, latest.export_usd, "#2f6df6"], ["신고수량", comparison.export_units, latest.export_units, "#16a36a"], ["평균 단위가치", comparison.usd_per_unit, latest.usd_per_unit, "#f08a24"]].map(([label, before, after, color]) => <div className="compare-row" key={String(label)}><b>{label}</b><div className="bar-label"><span>2025.09</span><i style={{ width: `${Math.max(4, Number(before) / Number(after) * 100)}%`, background: String(color) }} /></div><div className="bar-label"><span>2026.09</span><i style={{ width: "100%", background: String(color) }} /></div></div>)}</div></div></div></section>

    <section id="history" className="section" ref={storyRef}><div className="container wide"><SectionTitle number="02" eyebrow="THE LONG VIEW" title="20년의 가격과 수량" copy="같은 월을 세 지표에서 함께 읽어 가격·물량·금액의 움직임을 비교합니다." /><div className="control-bar"><div className="segmented">{presets.map(([label, months]) => <button className={range === months ? "active" : ""} onClick={() => setRange(months)} key={label}>{label}</button>)}</div><div className="controls"><select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="level">월별 원자료</option><option value="yoy">전년 동월 대비</option><option value="index">기준시점=100</option></select><select value={windowSize} onChange={(e) => setWindowSize(Number(e.target.value))}><option value="1">이동평균 없음</option><option value="3">3개월 평균</option><option value="6">6개월 평균</option><option value="12">12개월 평균</option></select><label className="check"><input type="checkbox" checked={logScale} onChange={e => setLogScale(e.target.checked)} />로그 축</label><button className="icon-button" onClick={saveChart}><ArrowDownToLine size={16} /> SVG</button></div></div><div className="hover-strip"><span>{active?.ym}</span><b style={{ color: "#2f6df6" }}>{active && compactUsd(active.export_usd)}</b><b style={{ color: "#16a36a" }}>{active && compactUnits(active.export_units)}</b><b style={{ color: "#f08a24" }}>{active && `$${active.usd_per_unit.toFixed(2)}`}</b></div><div className="chart-stack"><DataChart data={chartData} metric="export_usd" mode={mode} logScale={logScale} onHover={setHovered} /><DataChart data={chartData} metric="export_units" mode={mode} logScale={logScale} onHover={setHovered} /><DataChart data={chartData} metric="usd_per_unit" mode={mode} logScale={logScale} onHover={setHovered} /></div></div></section>

    <section id="drivers" className="section ink"><div className="container"><SectionTitle number="03" eyebrow="WHAT DROVE EXPORTS?" title="수출 증가의 진짜 원인" copy="두 시점의 수출액 차이를 평균 단위가치 요인과 신고수량 요인으로 대칭 분해합니다." /><div className="date-pickers"><label>기준 시점<select value={from} onChange={e => setFrom(e.target.value)}>{records.map(r => <option key={r.ym}>{r.ym}</option>)}</select></label><span>→</span><label>비교 시점<select value={to} onChange={e => setTo(e.target.value)}>{records.map(r => <option key={r.ym}>{r.ym}</option>)}</select></label></div>{dec && a && b && <><div className="driver-summary"><div><span>수출액 증감</span><b>{compactUsd(dec.delta)}</b><small>{formatPct(pct(b.export_usd, a.export_usd))}</small></div><div className="driver-lead"><p><em>{dec.priceShare?.toFixed(1)}%</em>가 평균 단위가치 변화에 해당</p><div className="share-track"><i style={{ width: `${Math.max(0, Math.min(100, dec.priceShare ?? 0))}%` }} /><span /></div><div className="share-legend"><span>단가 요인 {formatPct(dec.priceShare, 2)}</span><span>수량 요인 {formatPct(dec.quantityShare, 2)}</span></div></div></div><div className="driver-grid"><div className="dark-chart"><ResponsiveContainer width="100%" height={300}><BarChart data={barData} layout="vertical" margin={{ left: 20, right: 40 }}><CartesianGrid stroke="#344257" horizontal={false} /><XAxis type="number" tickFormatter={(v) => `${(v / 1e9).toFixed(0)}B`} stroke="#8795a8" /><YAxis dataKey="name" type="category" stroke="#dce4ef" width={76} /><Tooltip content={<MiniTooltip />} /><ReferenceLine x={0} stroke="#8795a8" /><Bar dataKey="value" name="기여 금액" radius={4}>{barData.map((_, i) => <Cell key={i} fill={i ? "#25b57a" : "#ff9d3d"} />)}</Bar></BarChart></ResponsiveContainer></div><blockquote>“{to} D램 수출액은 {from}보다 {formatPct(pct(b.export_usd, a.export_usd))} 변했다. 신고수량은 {formatPct(pct(b.export_units, a.export_units))}, 평균 단위가치는 {formatPct(pct(b.usd_per_unit, a.usd_per_unit))} 변했다. 수출액 증감분 중 평균 단위가치 요인의 몫은 {dec.priceShare?.toFixed(1)}%다.”<small>회계적 분해이며 인과관계를 뜻하지 않습니다.</small></blockquote></div></>}</div></section>

    <section id="cycles" className="section pale"><div className="container wide"><SectionTitle number="04" eyebrow="SUPERCYCLE COMPARISON" title="역대 반도체 슈퍼사이클" copy="각 비교 구간의 첫 달을 100으로 맞춰 상승 속도와 지속 기간을 겹쳐 봅니다." /><div className="metric-tabs">{(Object.keys(metricMeta) as Metric[]).map(m => <button key={m} onClick={() => setCycleMetric(m)} className={cycleMetric === m ? "active" : ""}>{metricMeta[m].label}</button>)}</div><div className="cycle-chart"><ResponsiveContainer width="100%" height={430}><LineChart data={cycleData} margin={{ top: 10, right: 24, left: 10, bottom: 16 }}><CartesianGrid stroke="#dbe2ea" strokeDasharray="3 5" /><XAxis dataKey="month" label={{ value: "시작 후 개월", position: "insideBottom", offset: -8 }} /><YAxis tickFormatter={(v) => `${v}`} /><Tooltip content={<MiniTooltip />} /><ReferenceLine y={100} stroke="#69778a" strokeDasharray="5 5" />{[["2017–18", "#8393a8"], ["2021–22", "#2f6df6"], ["2024–26", "#f08a24"]].map(([key, color]) => <Line key={key} type="monotone" dataKey={key} name={key} stroke={color} strokeWidth={key === "2024–26" ? 3 : 2} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></div><div className="cycle-note"><b>읽는 법</b><span>100보다 높으면 각 구간 시작보다 상승, 낮으면 하락입니다.</span><span>2024~2026년은 아직 종료된 사이클로 단정하지 않습니다.</span></div></div></section>

    <section id="relation" className="section"><div className="container"><SectionTitle number="05" eyebrow="LEAD & LAG" title="가격과 수량의 관계" copy="12개월 증가율을 기준으로 평균 단위가치 변화와 신고수량 변화의 시차 상관을 살펴봅니다." /><div className="lag-control"><div><span>시차</span><b>{lag === 0 ? "동행" : lag > 0 ? `가격 선행 ${lag}개월` : `수량 선행 ${Math.abs(lag)}개월`}</b></div><input type="range" min="-12" max="12" value={lag} onChange={e => setLag(Number(e.target.value))} /><div className="lag-scale"><span>-12</span><span>0</span><span>+12</span></div></div><div className="relation-grid"><div className="correlation"><span>상관계수</span><strong>{lagResult.correlation?.toFixed(2) ?? "—"}</strong><small>유효 표본 {lagResult.n}개월</small><p>상관계수는 두 변화율이 함께 움직인 정도입니다. 미래 예측력이나 인과관계를 뜻하지 않습니다.</p></div><div className="scatter"><ResponsiveContainer width="100%" height={340}><ScatterChart margin={{ top: 20, right: 20, bottom: 24, left: 12 }}><CartesianGrid stroke="#dbe2ea" strokeDasharray="3 5" /><XAxis type="number" dataKey="price" name="단가" unit="%" label={{ value: "평균 단위가치 증감률", position: "insideBottom", offset: -14 }} /><YAxis type="number" dataKey="units" name="수량" unit="%" label={{ value: "신고수량 증감률", angle: -90, position: "insideLeft" }} /><ZAxis range={[20, 20]} /><ReferenceLine x={0} stroke="#8995a5" /><ReferenceLine y={0} stroke="#8995a5" /><Tooltip cursor={{ strokeDasharray: "3 3" }} /><Scatter data={scatterData} fill="#2f6df6" fillOpacity={0.55} /></ScatterChart></ResponsiveContainer></div></div></div></section>

    <section id="records" className="section records-section"><div className="container"><SectionTitle number="06" eyebrow="HIGHS & LOWS" title="역사적 최고·최저 기록" copy="237개월 전체를 원자료로 계산한 기록입니다. 카드를 누르면 20년 시계열에서 해당 월을 확인할 수 있습니다." /><div className="record-grid">{recordsByMetric.map((item, i) => <a href="#history" className="record-card" key={item.label} onClick={() => { setRange(999); setHovered(item.ym); }}><span>{String(i + 1).padStart(2, "0")}</span><p>{item.label}</p><b>{item.display}</b><em>{item.ym}</em></a>)}</div></div></section>

    <section id="lab" className="section pale"><div className="container wide"><SectionTitle number="07" eyebrow="DATA LAB" title="데이터 실험실" copy="월별 원자료를 검색하고 내려받아 직접 분석할 수 있습니다." /><div className="lab-toolbar"><label><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="연월 검색 (예: 2024)" /></label><button onClick={() => downloadCsv(records, "DRAM_월별_통관데이터_2007-2026.csv")}><ArrowDownToLine size={17} /> 전체 CSV</button></div><div className="table-wrap"><table><thead><tr><th>연월</th><th>수출금액</th><th>신고수량</th><th>평균 단위가치</th><th>수출중량</th><th>금액 YoY</th><th>수량 YoY</th><th>단가 YoY</th></tr></thead><tbody>{tableRows.map(r => <tr key={r.ym}><td><b>{r.ym}</b></td><td>{r.export_usd.toLocaleString()}</td><td>{r.export_units.toLocaleString()}</td><td>${r.usd_per_unit.toFixed(3)}</td><td>{r.export_weight_g.toLocaleString()}</td><td className={(r.export_yoy_pct ?? 0) >= 0 ? "positive" : "negative"}>{formatPct(r.export_yoy_pct)}</td><td className={(r.units_yoy_pct ?? 0) >= 0 ? "positive" : "negative"}>{formatPct(r.units_yoy_pct)}</td><td className={(r.avg_value_yoy_pct ?? 0) >= 0 ? "positive" : "negative"}>{formatPct(r.avg_value_yoy_pct)}</td></tr>)}</tbody></table></div><p className="table-note">표에는 최근 36개 검색 결과를 표시합니다. 다운로드 파일은 전체 237개월이며 Excel에서 한글이 깨지지 않는 UTF-8 BOM 형식입니다.</p></div></section>

    <section id="method" className="section method"><div className="container"><SectionTitle number="08" eyebrow="METHODOLOGY" title="데이터와 분석 방법론" /><div className="method-callout"><Database /><p>본 사이트의 <b>‘가격’</b>은 수출금액을 신고수량으로 나눈 개당 평균 수출단가를 의미합니다. 개별 반도체 제품의 실제 거래가격이나 비트당 가격을 직접 나타내지는 않습니다.</p></div><div className="method-grid"><article><h3>데이터</h3><dl><div><dt>출처</dt><dd>한국무역협회 K-stat·관세청</dd></div><div><dt>품목</dt><dd>HSK 8542321010 (디램)</dd></div><div><dt>기간</dt><dd>2007.01~2026.09, 237개월</dd></div><div><dt>단위</dt><dd>US$, g, U</dd></div></dl></article><article><h3>계산</h3><p><b>평균 단위가치</b> = 수출금액 ÷ 신고수량</p><p><b>전년 동월 대비</b> = (당월 ÷ 12개월 전 − 1) × 100</p><p><b>대칭 분해</b>는 단가·수량 변화의 교차항을 절반씩 배분합니다.</p></article><article><h3>한계</h3><p>제품의 용량·성능·구성 변화가 평균 단위가치에 반영됩니다. 고부가가치 D램 비중 변화도 영향을 줄 수 있습니다.</p><p>U 신고단위와 실제 칩 개수의 일치 여부, 장기 HSK 분류 연속성은 완전히 검증되지 않았습니다. 이 자료만으로 HBM을 별도 산출하지 않습니다.</p></article></div><div className="validation"><CheckCircle2 /><div><b>데이터 검증 완료</b><span>237개월 · 누락 0 · 중복 0 · 수량 0인 월 0 · 단가 계산 일치</span></div></div></div></section>

    <footer><div><a className="brand" href="#top"><span>DRAM</span> CYCLE</a><p>한국 D램 수출 20년의 기록</p></div><div><span>DATA</span><b>K-stat · 관세청</b></div><a href="#top">맨 위로 ↑</a></footer>
  </main>;
}

