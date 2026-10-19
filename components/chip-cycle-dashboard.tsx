"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Filter,
  Layers,
  Menu,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X,
} from "lucide-react";
import {
  ChipCyclePayload,
  ItemKey,
  ItemMetric,
  MonthlyCombinedRecord,
  buildMultiItemSeries,
  compactUnits,
  compactUsd,
  downloadThreeItemsCsv,
  formatPct,
  itemMeta,
  lagCorrelationItem,
  pct,
  shapleyItem,
} from "@/lib/analysis";
import {
  EXPERT_QUOTES,
  SIX_KEY_QUESTIONS,
  VALIDATION_CHECKLIST,
  getAnnotationForMonth,
} from "@/lib/editorial-content";
import STATIC_CHIP_PAYLOAD from "@/public/data/chip-cycle-data.json";

const RANGE_PRESETS = [
  ["전체 (20년)", 237],
  ["최근 10년", 120],
  ["최근 5년", 60],
  ["최근 3년", 36],
  ["최근 1년", 12],
] as const;

const ITEMS: ItemKey[] = ["DRAM", "FLASH", "MCP"];

function SectionHeader({
  act,
  eyebrow,
  title,
  copy,
}: {
  act: string;
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="section-heading">
      <div className="section-number">{act}</div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {copy && <p className="section-copy">{copy}</p>}
      </div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  unitSuffix = "",
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  unitSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <b>{label}</b>
      {payload.map((item, idx) => (
        <span key={`${item.name}-${idx}`}>
          <i style={{ background: item.color }} />
          {item.name}
          <em>
            {typeof item.value === "number"
              ? item.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
              : item.value}
            {unitSuffix}
          </em>
        </span>
      ))}
    </div>
  );
}

function QuoteSection({ actId }: { actId: string }) {
  const quotes = EXPERT_QUOTES.filter((q) => q.act === actId);
  if (!quotes.length) return null;
  return (
    <details className="deep-dive-drawer" style={{ marginTop: 20 }}>
      <summary>
        <span>💬 관련 기관 · 전문가 코멘트 및 원문 출처 ({quotes.length}건)</span>
      </summary>
      <div className="deep-dive-body" style={{ padding: 16 }}>
        <div className="quote-grid" style={{ marginTop: 0 }}>
          {quotes.map((q) => (
            <article className="quote-card" key={q.id} style={{ padding: "16px 18px" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#2f6df6", marginBottom: 6 }}>
                  {q.date} · {q.affiliation}
                </div>
                <blockquote style={{ fontSize: 13.5, marginBottom: 8 }}>“{q.quote}”</blockquote>
              </div>
              <div className="quote-meta" style={{ paddingTop: 10 }}>
                <div>
                  <b>{q.speaker}</b>
                </div>
                <a
                  className="quote-link"
                  href={q.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={q.sourceTitle}
                >
                  원문 <ExternalLink size={12} />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </details>
  );
}

export default function ChipCycleDashboard({ initialData }: { initialData?: ChipCyclePayload | null }) {
  const [payload] = useState<ChipCyclePayload>(
    initialData ?? (STATIC_CHIP_PAYLOAD as unknown as ChipCyclePayload)
  );
  const [mounted, setMounted] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  // Visualization A (ACT 03 - 20-year competition) controls
  const [rangeMonths, setRangeMonths] = useState<number>(237);
  const [customStartYm, setCustomStartYm] = useState<string>("2007-01");
  const [customEndYm, setCustomEndYm] = useState<string>("2026-09");
  const [useCustomRange, setUseCustomRange] = useState<boolean>(false);
  const [modeA, setModeA] = useState<"level" | "yoy" | "index">("level");
  const [maWindowA, setMaWindowA] = useState<number>(1);
  const [logScaleA, setLogScaleA] = useState<boolean>(false);
  const [highlightItem, setHighlightItem] = useState<ItemKey | "ALL">("ALL");
  const [singleItemView, setSingleItemView] = useState<boolean>(false);
  const [hoveredYm, setHoveredYm] = useState<string>("2026-09");

  // Visualization B (ACT 04 - 2026 Price Surge Index & BOK EPI Cross-Validation)
  const [indexBaseYm, setIndexBaseYm] = useState<string>("2025-09");
  const [bokCompareItem, setBokCompareItem] = useState<"DRAM" | "FLASH" | "MACRO">("DRAM");
  const [bokCurrencyMode, setBokCurrencyMode] = useState<"usd" | "krw">("usd");

  // Visualization C (ACT 02 - Shapley Decomposition)
  const [shapleyTargetItem, setShapleyTargetItem] = useState<ItemKey>("DRAM");
  const [shapleyFromYm, setShapleyFromYm] = useState<string>("2025-09");
  const [shapleyToYm, setShapleyToYm] = useState<string>("2026-09");

  // Visualization D (ACT 06 - Supercycle Comparison)
  const [cycleItemFilter, setCycleItemFilter] = useState<ItemKey>("DRAM");
  const [cycleMetricFilter, setCycleMetricFilter] = useState<ItemMetric>("usd_per_U");

  // ACT 09 - Lead & Lag Correlation
  const [lagItem, setLagItem] = useState<ItemKey>("DRAM");
  const [lagMonths, setLagMonths] = useState<number>(0);

  // Data Lab
  const [labSearch, setLabSearch] = useState<string>("");
  const [labItemFilter, setLabItemFilter] = useState<ItemKey | "ALL">("ALL");

  const chartARef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const monthly = payload?.monthly ?? [];
  const latest = monthly.at(-1);
  const prevYearSept = monthly.find((m) => m.ym === "2025-09");

  // Filtered slice for Visualization A
  const visibleMonthly = useMemo(() => {
    if (!monthly.length) return [];
    if (useCustomRange) {
      const s = customStartYm <= customEndYm ? customStartYm : customEndYm;
      const e = customStartYm <= customEndYm ? customEndYm : customStartYm;
      return monthly.filter((m) => m.ym >= s && m.ym <= e);
    }
    return rangeMonths >= monthly.length ? monthly : monthly.slice(-rangeMonths);
  }, [monthly, rangeMonths, useCustomRange, customStartYm, customEndYm]);

  // Multi-item series for Visualization A
  const seriesUsd = useMemo(
    () => buildMultiItemSeries(visibleMonthly, "export_usd", modeA, maWindowA),
    [visibleMonthly, modeA, maWindowA]
  );
  const seriesUnits = useMemo(
    () => buildMultiItemSeries(visibleMonthly, "export_units_U", modeA, maWindowA),
    [visibleMonthly, modeA, maWindowA]
  );
  const seriesPrice = useMemo(
    () => buildMultiItemSeries(visibleMonthly, "usd_per_U", modeA, maWindowA),
    [visibleMonthly, modeA, maWindowA]
  );

  // Peak points in visibleMonthly for Visualization A
  const visiblePeaks = useMemo(() => {
    if (!visibleMonthly.length) return null;
    const result: Record<ItemKey, { usdPeakYm: string; unitsPeakYm: string; pricePeakYm: string; cumPricePct: number | null }> = {
      DRAM: { usdPeakYm: "", unitsPeakYm: "", pricePeakYm: "", cumPricePct: null },
      FLASH: { usdPeakYm: "", unitsPeakYm: "", pricePeakYm: "", cumPricePct: null },
      MCP: { usdPeakYm: "", unitsPeakYm: "", pricePeakYm: "", cumPricePct: null },
    };
    for (const k of ITEMS) {
      const pUsd = visibleMonthly.reduce((a, b) => (b[k].export_usd > a[k].export_usd ? b : a));
      const pUnits = visibleMonthly.reduce((a, b) => (b[k].export_units_U > a[k].export_units_U ? b : a));
      const pPrice = visibleMonthly.reduce((a, b) => (b[k].usd_per_U > a[k].usd_per_U ? b : a));
      const first = visibleMonthly[0][k].usd_per_U;
      const last = visibleMonthly.at(-1)![k].usd_per_U;
      result[k] = {
        usdPeakYm: pUsd.ym,
        unitsPeakYm: pUnits.ym,
        pricePeakYm: pPrice.ym,
        cumPricePct: pct(last, first),
      };
    }
    return result;
  }, [visibleMonthly]);

  // Active hovered record for Visualization A
  const activeHoverRow = useMemo(
    () => monthly.find((m) => m.ym === hoveredYm) ?? latest,
    [monthly, hoveredYm, latest]
  );
  const activeAnnotation = useMemo(
    () => getAnnotationForMonth(activeHoverRow?.ym ?? "2026-09"),
    [activeHoverRow]
  );

  // Visualization B: 2025-09=100 (or selected base) Price Surge Index
  const priceSurgeData = useMemo(() => {
    if (!monthly.length) return [];
    const baseRow = monthly.find((m) => m.ym === indexBaseYm) ?? monthly.find((m) => m.ym === "2025-09") ?? monthly[0];
    const slice = monthly.filter((m) => m.ym >= "2023-01");
    return slice.map((m) => ({
      ym: m.ym,
      DRAM: Number(((m.DRAM.usd_per_U / baseRow.DRAM.usd_per_U) * 100).toFixed(2)),
      FLASH: Number(((m.FLASH.usd_per_U / baseRow.FLASH.usd_per_U) * 100).toFixed(2)),
      MCP: Number(((m.MCP.usd_per_U / baseRow.MCP.usd_per_U) * 100).toFixed(2)),
      dramRaw: Number(m.DRAM.usd_per_U.toFixed(2)),
      flashRaw: Number(m.FLASH.usd_per_U.toFixed(2)),
      mcpRaw: Number(m.MCP.usd_per_U.toFixed(2)),
    }));
  }, [monthly, indexBaseYm]);

  // BOK EPI vs Customs Unit Value (2021-01 ~ 2026-06, rebased 2021-01 = 100)
  const bokCrossData = useMemo(() => {
    const slice = monthly.filter((m) => m.ym >= "2021-01" && m.ym <= "2026-07");
    if (!slice.length) return [];
    const base = slice[0];
    return slice.map((m) => {
      const dramCustomsIdx = (m.DRAM.usd_per_U / base.DRAM.usd_per_U) * 100;
      const flashCustomsIdx = (m.FLASH.usd_per_U / base.FLASH.usd_per_U) * 100;
      const dramBokIdxRaw = bokCurrencyMode === "usd" ? m.bok_epi.dram_usd_idx : m.bok_epi.dram_krw_idx;
      const dramBokBase = bokCurrencyMode === "usd" ? base.bok_epi.dram_usd_idx : base.bok_epi.dram_krw_idx;
      const flashBokIdxRaw = bokCurrencyMode === "usd" ? m.bok_epi.flash_usd_idx : m.bok_epi.flash_krw_idx;
      const flashBokBase = bokCurrencyMode === "usd" ? base.bok_epi.flash_usd_idx : base.bok_epi.flash_krw_idx;

      return {
        ym: m.ym,
        dramCustomsIdx: Number(dramCustomsIdx.toFixed(1)),
        dramBokIdx: dramBokIdxRaw && dramBokBase ? Number(((dramBokIdxRaw / dramBokBase) * 100).toFixed(1)) : null,
        flashCustomsIdx: Number(flashCustomsIdx.toFixed(1)),
        flashBokIdx: flashBokIdxRaw && flashBokBase ? Number(((flashBokIdxRaw / flashBokBase) * 100).toFixed(1)) : null,
        dramCustomsYoy: m.DRAM.unit_value_yoy_pct ? Number(m.DRAM.unit_value_yoy_pct.toFixed(1)) : null,
        dramBokYoy: bokCurrencyMode === "usd" ? m.bok_epi.dram_usd_yoy : m.bok_epi.dram_krw_yoy,
        flashCustomsYoy: m.FLASH.unit_value_yoy_pct ? Number(m.FLASH.unit_value_yoy_pct.toFixed(1)) : null,
        flashBokYoy: bokCurrencyMode === "usd" ? m.bok_epi.flash_usd_yoy : m.bok_epi.flash_krw_yoy,
      };
    });
  }, [monthly, bokCurrencyMode]);

  // Visualization C: Shapley Decomposition for all 3 items between shapleyFromYm and shapleyToYm
  const shapleyResults = useMemo(() => {
    const rowA = monthly.find((m) => m.ym === shapleyFromYm);
    const rowB = monthly.find((m) => m.ym === shapleyToYm);
    if (!rowA || !rowB) return null;
    return {
      fromYm: rowA.ym,
      toYm: rowB.ym,
      DRAM: { ...shapleyItem(rowA.DRAM, rowB.DRAM), a: rowA.DRAM, b: rowB.DRAM },
      FLASH: { ...shapleyItem(rowA.FLASH, rowB.FLASH), a: rowA.FLASH, b: rowB.FLASH },
      MCP: { ...shapleyItem(rowA.MCP, rowB.MCP), a: rowA.MCP, b: rowB.MCP },
    };
  }, [monthly, shapleyFromYm, shapleyToYm]);

  // Visualization D: Supercycle overlay series
  const supercycleOverlay = useMemo(() => {
    if (!monthly.length) return [];
    const windows = [
      { key: "2017–18 클라우드", start: "2016-07", end: "2019-06" },
      { key: "2021–22 팬데믹", start: "2020-12", end: "2023-06" },
      { key: "2024–26 AI 슈퍼사이클", start: "2023-06", end: "2026-09" },
    ];
    const maxLen = 40;
    const rows: Array<Record<string, number>> = Array.from({ length: maxLen }, (_, i) => ({ monthOffset: i }));
    for (const w of windows) {
      const slice = monthly.filter((m) => m.ym >= w.start && m.ym <= w.end);
      const baseVal = slice[0]?.[cycleItemFilter]?.[cycleMetricFilter] || 1;
      slice.forEach((m, idx) => {
        if (idx < maxLen) {
          rows[idx][w.key] = Number(((m[cycleItemFilter][cycleMetricFilter] / baseVal) * 100).toFixed(1));
        }
      });
    }
    return rows;
  }, [monthly, cycleItemFilter, cycleMetricFilter]);

  // ACT 09: Lag correlation & Historical High/Low Records
  const lagResult = useMemo(
    () => lagCorrelationItem(monthly, lagItem, lagMonths),
    [monthly, lagItem, lagMonths]
  );

  const historicalExtremes = useMemo(() => {
    if (!monthly.length) return [];
    const cards: Array<{ item: ItemKey; label: string; ym: string; display: string; sub: string }> = [];
    for (const k of ITEMS) {
      const maxPrice = monthly.reduce((a, b) => (b[k].usd_per_U > a[k].usd_per_U ? b : a));
      const minPrice = monthly.reduce((a, b) => (b[k].usd_per_U < a[k].usd_per_U ? b : a));
      const maxUsd = monthly.reduce((a, b) => (b[k].export_usd > a[k].export_usd ? b : a));
      const maxUnits = monthly.reduce((a, b) => (b[k].export_units_U > a[k].export_units_U ? b : a));
      cards.push(
        {
          item: k,
          label: `${itemMeta[k].shortName} 평균단가 역대 최고`,
          ym: maxPrice.ym,
          display: `$${maxPrice[k].usd_per_U.toFixed(2)}`,
          sub: `수출액 ${compactUsd(maxPrice[k].export_usd)}`,
        },
        {
          item: k,
          label: `${itemMeta[k].shortName} 평균단가 역대 최저`,
          ym: minPrice.ym,
          display: `$${minPrice[k].usd_per_U.toFixed(2)}`,
          sub: `수출액 ${compactUsd(minPrice[k].export_usd)}`,
        },
        {
          item: k,
          label: `${itemMeta[k].shortName} 월간 수출액 최고`,
          ym: maxUsd.ym,
          display: compactUsd(maxUsd[k].export_usd),
          sub: `단가 $${maxUsd[k].usd_per_U.toFixed(2)}/U`,
        },
        {
          item: k,
          label: `${itemMeta[k].shortName} 월간 신고수량 최고`,
          ym: maxUnits.ym,
          display: compactUnits(maxUnits[k].export_units_U),
          sub: `단가 $${maxUnits[k].usd_per_U.toFixed(2)}/U`,
        }
      );
    }
    return cards;
  }, [monthly]);

  // Data Lab filtered rows (711 total rows)
  const labRows = useMemo(() => {
    const out: Array<MonthlyCombinedRecord["DRAM"]> = [];
    for (let i = monthly.length - 1; i >= 0; i--) {
      const m = monthly[i];
      if (labSearch && !m.ym.includes(labSearch)) continue;
      for (const k of ITEMS) {
        if (labItemFilter !== "ALL" && labItemFilter !== k) continue;
        out.push(m[k]);
      }
    }
    return out.slice(0, 90);
  }, [monthly, labSearch, labItemFilter]);

  if (!mounted || !payload || !latest || !prevYearSept) {
    return (
      <div className="loading">
        <span />
        CHIP CYCLE 인터랙티브 리포트를 준비하는 중…
      </div>
    );
  }

  const sep2026ComparisonChart = ITEMS.map((k) => ({
    name: itemMeta[k].shortName,
    key: k,
    수출액증가율: Number((latest[k].value_yoy_pct ?? 0).toFixed(1)),
    신고수량증가율: Number((latest[k].units_yoy_pct ?? 0).toFixed(1)),
    평균단가상승률: Number((latest[k].unit_value_yoy_pct ?? 0).toFixed(1)),
  }));

  const exportSvg = () => {
    const svg = chartARef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chip-cycle-20yr-chart.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      {/* Top Sticky Header */}
      <header className="topbar">
        <a className="brand" href="#top">
          <span>CHIP</span> CYCLE
          <small className="brand-sub">2007.01–2026.09</small>
        </a>
        <nav className={mobileNav ? "open" : ""}>
          {[
            ["ACT 1. 수출과 수량", "act1"],
            ["ACT 2. 가격·수량 분해", "act2"],
            ["ACT 3. 20년 시계열", "act3"],
            ["ACT 4. 단가·한은 검증", "act4"],
            ["ACT 5. AI 메커니즘", "act5"],
            ["ACT 6. 슈퍼사이클", "act6"],
            ["ACT 7. 거시 파급", "act7"],
            ["ACT 8. 2027 전망", "act8"],
            ["ACT 9. 시차·기록", "act9"],
            ["실험실", "lab"],
          ].map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setMobileNav(false)}>
              {label}
            </a>
          ))}
          <button className="nav-close" onClick={() => setMobileNav(false)} aria-label="메뉴 닫기">
            <X />
          </button>
        </nav>
        <button className="menu" onClick={() => setMobileNav(true)} aria-label="메뉴 열기">
          <Menu />
        </button>
      </header>

      {/* HERO SECTION */}
      <section id="top" className="hero">
        <div className="hero-grid" />
        <div className="hero-inner">
          <div className="hero-kicker">
            <span>KOREA SEMICONDUCTOR EXPORTS (2007.01–2026.09 · 711 OBSERVATIONS)</span>
            <span>DATA: K-STAT · KOREA CUSTOMS · BANK OF KOREA ECOS</span>
          </div>
          <h1>
            반도체 수출액은 폭증했는데,
            <br />
            <em>판매 개수는 줄었다</em>
          </h1>
          <p className="hero-subtitle">
            D램·플래시·복합구조칩 237개월 통관데이터와 한국은행 수출물가지수로 본 2026 AI 슈퍼사이클의 구조 변화
          </p>

          <div className="hero-facts">
            <div className="hero-fact-card" style={{ borderLeftColor: "#2f6df6" }}>
              <b>+532.1% vs +1.5%</b>
              <span>2026.09 D램 수출액 vs 신고수량 YoY</span>
              <small>개당 단가 $3.94 → $24.55 (+522.5%)</small>
            </div>
            <div className="hero-fact-card" style={{ borderLeftColor: "#16a36a" }}>
              <b>+366.5% vs -10.8%</b>
              <span>2026.09 플래시 수출액 vs 신고수량 YoY</span>
              <small>개당 단가 $1.77 → $9.28 (+423.1%)</small>
            </div>
            <div className="hero-fact-card" style={{ borderLeftColor: "#8b5cf6" }}>
              <b>+186.9% vs -27.3%</b>
              <span>2026.09 복합구조칩 수출액 vs 신고수량 YoY</span>
              <small>개당 단가 $21.41 → $84.47 (+294.5%)</small>
            </div>
            <div className="hero-fact-card" style={{ borderLeftColor: "#f08a24" }}>
              <b>+9.4%p 사상 최대</b>
              <span>2026.1Q 실질 GDI(13.2%) - GDP(3.8%) 격차</span>
              <small>1960년 이후 최대 교역조건 무역이익</small>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a className="scroll-cue" href="#act1">
              ACT 01. 2026년 9월 실적 비교 <span>↓</span>
            </a>
            <a
              className="scroll-cue"
              href="#act3"
              style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.22)" }}
            >
              시각화 A. 20년 시계열 바로가기 →
            </a>
          </div>
        </div>
      </section>

      {/* ACT 01. 한국 수출을 움직이는 반도체 & 2026년 9월의 역설 */}
      <section id="act1" className="section pale">
        <div className="container wide">
          <SectionHeader
            act="ACT 01"
            eyebrow="THE PARADOX OF SEPTEMBER 2026"
            title="반도체 수출액은 폭증했는데, 판매 개수는 줄었다"
            copy="2026년 9월 3대 품목 합산 수출액은 350.9억 달러로 1년 전의 4.1배로 뛰었지만, 통관 신고수량은 정체하거나 감소했습니다."
          />

          {/* 3 Items KPI Cards */}
          <div className="three-item-grid">
            {ITEMS.map((k) => {
              const meta = itemMeta[k];
              const cur = latest[k];
              const prev = prevYearSept[k];
              return (
                <article
                  key={k}
                  className="item-card"
                  style={{ "--item-color": meta.color } as React.CSSProperties}
                >
                  <div className="item-card-header">
                    <span className="item-badge">
                      <i style={{ background: meta.color }} />
                      {meta.name}
                    </span>
                    <span className="hsk-code">HSK {meta.hsk}</span>
                  </div>
                  <div className="item-kpi-row">
                    <div>
                      <span>2026.09 수출액</span>
                      <strong>{compactUsd(cur.export_usd)}</strong>
                      <em className={(cur.value_yoy_pct ?? 0) >= 0 ? "pos" : "neg"}>
                        {formatPct(cur.value_yoy_pct, 1)} YoY
                      </em>
                    </div>
                    <div>
                      <span>신고수량(U)</span>
                      <strong>{compactUnits(cur.export_units_U)}</strong>
                      <em className={(cur.units_yoy_pct ?? 0) >= 0 ? "pos" : "neg"}>
                        {formatPct(cur.units_yoy_pct, 1)} YoY
                      </em>
                    </div>
                    <div>
                      <span>개당 평균단가</span>
                      <strong>${cur.usd_per_U.toFixed(2)}</strong>
                      <em className={(cur.unit_value_yoy_pct ?? 0) >= 0 ? "pos" : "neg"}>
                        {formatPct(cur.unit_value_yoy_pct, 1)} YoY
                      </em>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                    <span>2025.09 단가: ${prev.usd_per_U.toFixed(2)}/U</span>
                    <span>중량단가: ${(cur.usd_per_kg / 1000).toFixed(1)}천$/kg</span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Dual Chart: 2026.09 YoY Bar Comparison + MTI 831 Total vs 3 Items */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 20 }}>
            <div className="chart-stack" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="chart-panel">
                <div className="chart-title">
                  <div>
                    <BarChart3 size={16} color="#2f6df6" />
                    2026년 9월 vs 2025년 9월: 수출액·단가·수량 변화율(%) 비교
                  </div>
                  <span>단위: 전년 동월 대비(%)</span>
                </div>
                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sep2026ComparisonChart} margin={{ top: 16, right: 20, left: 4, bottom: 8 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#1e293b", fontWeight: 700, fontSize: 13 }} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#64748b", fontSize: 11.5 }} width={56} />
                      <Tooltip content={<CustomTooltip unitSuffix="%" />} />
                      <Legend />
                      <ReferenceLine y={0} stroke="#475569" />
                      <Bar dataKey="수출액증가율" name="수출액 증가율(%)" fill="#2f6df6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="평균단가상승률" name="개당 단가 상승률(%)" fill="#f08a24" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="신고수량증가율" name="신고수량 증감률(%)" fill="#16a36a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-takeaway">
                <b>핵심 사실</b>
                <span>
                  세 품목 모두 수출액 증가율(파랑)과 단가 상승률(주황)이 동행한 반면, 신고수량(초록)은 정체·감소했습니다.
                </span>
              </div>
            </div>

            <div className="chart-stack" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="chart-panel">
                <div className="chart-title">
                  <div>
                    <Layers size={16} color="#8b5cf6" />
                    전체 반도체(MTI 831) 수출액과 3대 품목 비중 (2007–2026.09)
                  </div>
                  <span>단위: 억 달러 (월별)</span>
                </div>
                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={monthly.map((m) => ({
                        ym: m.ym,
                        DRAM: Number((m.DRAM.export_usd / 1e8).toFixed(2)),
                        FLASH: Number((m.FLASH.export_usd / 1e8).toFixed(2)),
                        MCP: Number((m.MCP.export_usd / 1e8).toFixed(2)),
                        전체반도체: m.total_semicon.export_usd
                          ? Number((m.total_semicon.export_usd / 1e8).toFixed(2))
                          : null,
                      }))}
                      margin={{ top: 16, right: 16, left: 4, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="ym"
                        minTickGap={42}
                        tickFormatter={(v) => String(v).slice(0, 4)}
                        tick={{ fill: "#64748b", fontSize: 11.5 }}
                      />
                      <YAxis
                        tickFormatter={(v) => `${v}억`}
                        tick={{ fill: "#64748b", fontSize: 11.5 }}
                        width={56}
                      />
                      <Tooltip content={<CustomTooltip unitSuffix="억 달러" />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="DRAM"
                        stackId="1"
                        name="D램 (8542321010)"
                        fill="#2f6df6"
                        stroke="#2f6df6"
                        fillOpacity={0.75}
                      />
                      <Area
                        type="monotone"
                        dataKey="MCP"
                        stackId="1"
                        name="복합구조칩 (8542323000)"
                        fill="#8b5cf6"
                        stroke="#8b5cf6"
                        fillOpacity={0.75}
                      />
                      <Area
                        type="monotone"
                        dataKey="FLASH"
                        stackId="1"
                        name="플래시 메모리 (8542321030)"
                        fill="#16a36a"
                        stroke="#16a36a"
                        fillOpacity={0.75}
                      />
                      <Line
                        type="monotone"
                        dataKey="전체반도체"
                        name="전체 반도체 (MTI 831 총계)"
                        stroke="#0d1d33"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-takeaway">
                <b>구조 변화</b>
                <span>
                  2026.09 전체 반도체(603.0억$) 중 3대 품목이 350.9억$(58.2%)를 차지하며 D램과 복합구조칩이 성장을 양분합니다.
                </span>
              </div>
            </div>
          </div>

          {/* Collapsible Fact vs Interpretation Box */}
          <details className="deep-dive-drawer">
            <summary>
              <span>📌 관세청 통관 확인 사실(Fact) vs 단가 상승 원인 해석(Interpretation) 구분 보기</span>
            </summary>
            <div className="deep-dive-body">
              <div className="narrative-grid" style={{ margin: 0 }}>
                <div className="narrative-box fact" style={{ padding: 16 }}>
                  <span className="narrative-tag">① 통관데이터 확인 사실 (FACT)</span>
                  <ul className="compact-bullets">
                    <li><b>수출액 급증:</b> D램 167.8억$(+532.1%), 복합구조칩 150.1억$(+186.9%), 플래시 33.0억$(+366.5%)</li>
                    <li><b>신고수량 정체·감소:</b> D램 +1.5%, 플래시 -10.8%, 복합구조칩 -27.3%</li>
                  </ul>
                </div>
                <div className="narrative-box interp" style={{ padding: 16 }}>
                  <span className="narrative-tag">② 가능한 원인 해석 및 유의점 (INTERPRETATION)</span>
                  <ul className="compact-bullets">
                    <li><b>복합 요인:</b> ① 메모리 계약가격 급등과 ② 고용량 서버 D램·eSSD·적층칩 등 고부가 제품 비중 확대가 동시에 반영됨</li>
                    <li><b>단위 유의:</b> 신고수량(U)은 패키지·모듈 단위이므로 총 출하 비트(Bit) 감소와 동일시하지 않음</li>
                  </ul>
                </div>
              </div>
            </div>
          </details>

          <QuoteSection actId="act1" />
        </div>
      </section>

      {/* ACT 02. 수출의 성장동력은 가격인가, 물량인가 (시각화 C: Shapley 대칭 분해) */}
      <section id="act2" className="section ink">
        <div className="container wide">
          <SectionHeader
            act="ACT 02"
            eyebrow="VISUALIZATION C · SHAPLEY PRICE-QUANTITY DECOMPOSITION"
            title="수출의 성장동력은 가격인가, 물량인가"
            copy="수출액 증감분을 ‘평균 단가 요인(P)’과 ‘신고수량 요인(Q)’으로 대칭 분해해 기여율을 비교합니다."
          />

          {/* Interactive Pickers */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "flex-end",
              justifyContent: "space-between",
              background: "#132742",
              border: "1px solid #2d4260",
              padding: "16px 20px",
              borderRadius: 4,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, color: "#93c5fd", fontWeight: 700, marginRight: 6 }}>
                품목 선택:
              </span>
              {ITEMS.map((k) => (
                <button
                  key={k}
                  onClick={() => setShapleyTargetItem(k)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 4,
                    border: `1.5px solid ${shapleyTargetItem === k ? itemMeta[k].color : "#334155"}`,
                    background: shapleyTargetItem === k ? itemMeta[k].color : "transparent",
                    color: "#fff",
                    fontWeight: 750,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {itemMeta[k].name}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: "#cbd5e1", display: "grid", gap: 4 }}>
                기준 월 (P₀, Q₀)
                <select
                  value={shapleyFromYm}
                  onChange={(e) => setShapleyFromYm(e.target.value)}
                  style={{ background: "#0d1d33", color: "#fff", border: "1px solid #475569", padding: "6px 10px" }}
                >
                  {monthly.map((m) => (
                    <option key={m.ym} value={m.ym}>
                      {m.ym}
                    </option>
                  ))}
                </select>
              </label>
              <span style={{ color: "#94a3b8", paddingTop: 18 }}>→</span>
              <label style={{ fontSize: 12, color: "#cbd5e1", display: "grid", gap: 4 }}>
                비교 월 (P₁, Q₁)
                <select
                  value={shapleyToYm}
                  onChange={(e) => setShapleyToYm(e.target.value)}
                  style={{ background: "#0d1d33", color: "#fff", border: "1px solid #475569", padding: "6px 10px" }}
                >
                  {monthly.map((m) => (
                    <option key={m.ym} value={m.ym}>
                      {m.ym}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", gap: 6, paddingTop: 18 }}>
                <button
                  onClick={() => {
                    setShapleyFromYm("2025-09");
                    setShapleyToYm("2026-09");
                  }}
                  style={{
                    fontSize: 11.5,
                    padding: "6px 10px",
                    background: "#1e3a5f",
                    color: "#93c5fd",
                    border: "1px solid #3b82f6",
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  최근 1년 (25.09→26.09)
                </button>
                <button
                  onClick={() => {
                    setShapleyFromYm("2016-09");
                    setShapleyToYm("2018-09");
                  }}
                  style={{
                    fontSize: 11.5,
                    padding: "6px 10px",
                    background: "#1e293b",
                    color: "#cbd5e1",
                    border: "1px solid #475569",
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  2018 슈퍼사이클
                </button>
              </div>
            </div>
          </div>

          {shapleyResults && (
            <>
              {/* 3-Item Side-by-Side Price Share Comparison Cards */}
              <div className="three-item-grid">
                {ITEMS.map((k) => {
                  const res = shapleyResults[k];
                  const meta = itemMeta[k];
                  const isActive = shapleyTargetItem === k;
                  return (
                    <div
                      key={k}
                      onClick={() => setShapleyTargetItem(k)}
                      style={{
                        background: isActive ? "#173054" : "#11223b",
                        border: `2px solid ${isActive ? meta.color : "#293d59"}`,
                        padding: 20,
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: 15.5, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                          <i
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: meta.color,
                              display: "inline-block",
                            }}
                          />
                          {meta.name}
                        </strong>
                        <span style={{ fontSize: 11.5, color: "#93c5fd", fontWeight: 700 }}>
                          {shapleyResults.fromYm} → {shapleyResults.toYm}
                        </span>
                      </div>

                      <div style={{ margin: "14px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>수출액 증감분</span>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                            {res.delta >= 0 ? "+" : ""}
                            {compactUsd(res.delta)}
                          </div>
                          <small style={{ color: "#60a5fa", fontWeight: 700 }}>{formatPct(res.valuePct, 1)}</small>
                        </div>
                        <div>
                          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>단가 요인 기여율</span>
                          <div style={{ fontSize: 22, fontWeight: 850, color: "#fbbf24" }}>
                            {res.priceShare != null ? `${res.priceShare.toFixed(1)}%` : "—"}
                          </div>
                          <small style={{ color: "#cbd5e1" }}>
                            수량 기여율: {res.quantityShare != null ? `${res.quantityShare.toFixed(1)}%` : "—"}
                          </small>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#cbd5e1",
                          borderTop: "1px solid #293d59",
                          paddingTop: 10,
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>단가 요인: {compactUsd(res.price)}</span>
                        <span>수량 요인: {compactUsd(res.quantity)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Breakdown & Charts for Selected Item */}
              {(() => {
                const curRes = shapleyResults[shapleyTargetItem];
                const meta = itemMeta[shapleyTargetItem];
                const singleBarData = [
                  {
                    name: "단가 요인 (P 효과)",
                    금액억달러: Number((curRes.price / 1e8).toFixed(2)),
                    color: "#f08a24",
                  },
                  {
                    name: "수량 요인 (Q 효과)",
                    금액억달러: Number((curRes.quantity / 1e8).toFixed(2)),
                    color: "#16a36a",
                  },
                ];
                const multiCompareData = ITEMS.map((k) => ({
                  name: itemMeta[k].shortName,
                  단가요인억달러: Number((shapleyResults[k].price / 1e8).toFixed(2)),
                  수량요인억달러: Number((shapleyResults[k].quantity / 1e8).toFixed(2)),
                }));

                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 20, marginTop: 16 }}>
                      <div style={{ background: "#11223b", border: "1px solid #293d59", padding: 20, borderRadius: 4 }}>
                        <h4 style={{ margin: "0 0 12px", fontSize: 15, color: "#fff" }}>
                          [{meta.name}] 단가 vs 수량 기여 금액 ({shapleyResults.fromYm} → {shapleyResults.toYm})
                        </h4>
                        <div style={{ height: 210 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleBarData} layout="vertical" margin={{ left: 24, right: 30, top: 8, bottom: 8 }}>
                              <CartesianGrid stroke="#293d59" horizontal={false} />
                              <XAxis type="number" tickFormatter={(v) => `${v}억$`} stroke="#94a3b8" />
                              <YAxis type="category" dataKey="name" stroke="#e2e8f0" width={120} />
                              <Tooltip content={<CustomTooltip unitSuffix="억 달러" />} />
                              <ReferenceLine x={0} stroke="#cbd5e1" />
                              <Bar dataKey="금액억달러" name="기여 금액(억 달러)" radius={4}>
                                {singleBarData.map((entry, idx) => (
                                  <Cell key={idx} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div style={{ background: "#11223b", border: "1px solid #293d59", padding: 20, borderRadius: 4 }}>
                        <h4 style={{ margin: "0 0 12px", fontSize: 15, color: "#fff" }}>
                          3개 품목 단가 요인 vs 수량 요인 기여 금액 동시 비교 (억 달러)
                        </h4>
                        <div style={{ height: 210 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={multiCompareData} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
                              <CartesianGrid stroke="#293d59" strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" stroke="#cbd5e1" fontSize={12} />
                              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v}억`} />
                              <Tooltip content={<CustomTooltip unitSuffix="억 달러" />} />
                              <ReferenceLine y={0} stroke="#94a3b8" />
                              <Bar dataKey="단가요인억달러" name="단가 요인(억$)" fill="#f08a24" radius={[3, 3, 0, 0]} />
                              <Bar dataKey="수량요인억달러" name="수량 요인(억$)" fill="#16a36a" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    <details className="deep-dive-drawer">
                      <summary>
                        <span>📐 [{meta.name}] 자동 생성 분해 리포트 및 Shapley 산출 공식 보기</span>
                      </summary>
                      <div className="deep-dive-body">
                        <p style={{ margin: "0 0 8px", fontSize: 14.5 }}>
                          <b>{shapleyResults.toYm} {meta.name}</b> 수출액({compactUsd(curRes.b.export_usd)})은{" "}
                          <b>{shapleyResults.fromYm}</b>({compactUsd(curRes.a.export_usd)}) 대비{" "}
                          <b>{formatPct(curRes.valuePct, 1)}</b> ({compactUsd(curRes.delta)}) 변했습니다. 평균 단가 요인이{" "}
                          <b style={{ color: "#fbbf24" }}>{compactUsd(curRes.price)} ({curRes.priceShare?.toFixed(1)}%)</b>,
                          신고수량 요인이{" "}
                          <b style={{ color: "#4ade80" }}>{compactUsd(curRes.quantity)} ({curRes.quantityShare?.toFixed(1)}%)</b>를 차지했습니다.
                        </p>
                        <p style={{ margin: 0, fontSize: 12.5, color: "#94a3b8" }}>
                          • 산출 공식: 단가 요인 = (P₁−P₀)×(Q₀+Q₁)/2 · 수량 요인 = (Q₁−Q₀)×(P₀+P₁)/2 (합산 오차 $0.00)
                          <br />• 왜 기여율이 100%를 넘을까? 수량 감소(음의 수량 효과)가 수출액을 깎아내렸음에도 단가 상승분이 이를 모두 상쇄하고 순증을 기록했기 때문입니다.
                        </p>
                      </div>
                    </details>
                  </>
                );
              })()}
            </>
          )}
        </div>
      </section>

      {/* ACT 03. D램·플래시·복합구조칩, 세 반도체의 다른 움직임 (시각화 A & 역할 분석) */}
      <section id="act3" className="section" ref={chartARef}>
        <div className="container wide">
          <SectionHeader
            act="ACT 03"
            eyebrow="VISUALIZATION A · 20 YEARS OF COMPETITION (2007.01–2026.09)"
            title="D램·플래시·복합구조칩, 세 반도체의 20년 경쟁"
            copy="237개월 동안 세 반도체의 ① 수출금액, ② 신고수량, ③ 개당 평균 단가를 같은 시간축에서 비교합니다."
          />

          {/* Control Bar */}
          <div className="control-bar">
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div className="item-filter-pills">
                <button
                  className={`item-pill ${highlightItem === "ALL" && !singleItemView ? "active" : ""}`}
                  onClick={() => {
                    setHighlightItem("ALL");
                    setSingleItemView(false);
                  }}
                >
                  3품목 전체 비교
                </button>
                {ITEMS.map((k) => (
                  <button
                    key={k}
                    className={`item-pill ${highlightItem === k ? "active" : ""}`}
                    onClick={() => setHighlightItem(highlightItem === k && !singleItemView ? "ALL" : k)}
                    style={
                      highlightItem === k
                        ? { background: itemMeta[k].color, borderColor: itemMeta[k].color, color: "#fff" }
                        : {}
                    }
                  >
                    <i style={{ background: highlightItem === k ? "#fff" : itemMeta[k].color }} />
                    {itemMeta[k].shortName} 강조
                  </button>
                ))}
              </div>

              <label className="check" style={{ marginLeft: 6 }}>
                <input
                  type="checkbox"
                  checked={singleItemView}
                  onChange={(e) => {
                    setSingleItemView(e.target.checked);
                    if (e.target.checked && highlightItem === "ALL") setHighlightItem("DRAM");
                  }}
                />
                단일 품목 집중 모드
              </label>
            </div>

            <div className="controls">
              <div className="segmented">
                {RANGE_PRESETS.map(([label, months]) => (
                  <button
                    key={label}
                    className={!useCustomRange && rangeMonths === months ? "active" : ""}
                    onClick={() => {
                      setUseCustomRange(false);
                      setRangeMonths(months);
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button
                  className={useCustomRange ? "active" : ""}
                  onClick={() => setUseCustomRange(true)}
                >
                  기간 직접지정
                </button>
              </div>

              {useCustomRange && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select value={customStartYm} onChange={(e) => setCustomStartYm(e.target.value)}>
                    {monthly.map((m) => (
                      <option key={m.ym} value={m.ym}>
                        {m.ym}
                      </option>
                    ))}
                  </select>
                  <span>~</span>
                  <select value={customEndYm} onChange={(e) => setCustomEndYm(e.target.value)}>
                    {monthly.map((m) => (
                      <option key={m.ym} value={m.ym}>
                        {m.ym}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <select value={modeA} onChange={(e) => setModeA(e.target.value as typeof modeA)}>
                <option value="level">월별 원자료</option>
                <option value="yoy">전년 동월 대비 증가율(%)</option>
                <option value="index">선택 기간 시작=100 지수화</option>
              </select>

              <select value={maWindowA} onChange={(e) => setMaWindowA(Number(e.target.value))}>
                <option value={1}>이동평균 없음 (당월)</option>
                <option value={3}>3개월 이동평균</option>
                <option value={6}>6개월 이동평균</option>
                <option value={12}>12개월 이동평균</option>
              </select>

              <label className="check">
                <input
                  type="checkbox"
                  checked={logScaleA}
                  onChange={(e) => setLogScaleA(e.target.checked)}
                />
                로그 축
              </label>

              <button className="icon-button" onClick={exportSvg}>
                <ArrowDownToLine size={14} /> SVG
              </button>
              <button
                className="icon-button"
                onClick={() => downloadThreeItemsCsv(visibleMonthly, "CHIP_CYCLE_선택기간_3품목.csv")}
              >
                <ArrowDownToLine size={14} /> CSV
              </button>
            </div>
          </div>

          {/* Period Cumulative Return & Peak Summary Strip */}
          {visiblePeaks && visibleMonthly.length > 1 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginBottom: 12,
              }}
            >
              {ITEMS.map((k) => {
                const pk = visiblePeaks[k];
                const meta = itemMeta[k];
                return (
                  <div
                    key={k}
                    style={{
                      padding: "9px 14px",
                      background: meta.lightBg,
                      border: `1px solid ${meta.color}33`,
                      borderRadius: 4,
                      fontSize: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <b style={{ color: meta.color }}>{meta.shortName}</b>{" "}
                      <span style={{ color: "#475569" }}>단가 누적:</span>{" "}
                      <strong>{formatPct(pk.cumPricePct, 1)}</strong>
                    </div>
                    <span style={{ color: "#64748b", fontSize: 11 }}>
                      단가 최고: <b>{pk.pricePeakYm}</b> · 수량 최고: <b>{pk.unitsPeakYm}</b>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Interactive Hover Strip with Historical Context */}
          {activeHoverRow && (
            <div className="hover-strip">
              <div className="hover-strip-items">
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>
                  📅 {activeHoverRow.ym}
                </span>
                {ITEMS.map((k) => (
                  <span key={k} style={{ color: "#e2e8f0" }}>
                    <b style={{ color: itemMeta[k].color }}>{itemMeta[k].shortName}</b>:{" "}
                    {compactUsd(activeHoverRow[k].export_usd)} ·{" "}
                    {compactUnits(activeHoverRow[k].export_units_U)} ·{" "}
                    <b>${activeHoverRow[k].usd_per_U.toFixed(2)}/U</b>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "#93c5fd" }} title={activeAnnotation.description}>
                <b>[{activeAnnotation.tag}]</b> {activeAnnotation.title}
              </div>
            </div>
          )}

          {/* 3 Synchronized Charts */}
          <div className="chart-stack">
            {[
              {
                title: "① 월별 수출금액 (Export Value)",
                sub:
                  modeA === "yoy"
                    ? "전년 동월 대비 증감률(%)"
                    : modeA === "index"
                    ? `선택 구간 첫 달(${visibleMonthly[0]?.ym})=100 지수`
                    : "단위: 억 달러 (US$)",
                data: seriesUsd,
                formatter: (v: number) =>
                  modeA === "yoy"
                    ? `${v.toFixed(0)}%`
                    : modeA === "index"
                    ? v.toFixed(0)
                    : `${(v / 1e8).toFixed(0)}억`,
                peakKey: "usdPeakYm" as const,
              },
              {
                title: "② 월별 신고수량 (Declared Export Quantity)",
                sub:
                  modeA === "yoy"
                    ? "전년 동월 대비 증감률(%)"
                    : modeA === "index"
                    ? `선택 구간 첫 달(${visibleMonthly[0]?.ym})=100 지수`
                    : "단위: 억 개 (U)",
                data: seriesUnits,
                formatter: (v: number) =>
                  modeA === "yoy"
                    ? `${v.toFixed(0)}%`
                    : modeA === "index"
                    ? v.toFixed(0)
                    : `${(v / 1e8).toFixed(1)}억`,
                peakKey: "unitsPeakYm" as const,
              },
              {
                title: "③ 월별 개당 평균 단가 (Unit Value = 수출금액 ÷ 신고수량)",
                sub:
                  modeA === "yoy"
                    ? "전년 동월 대비 상승률(%)"
                    : modeA === "index"
                    ? `선택 구간 첫 달(${visibleMonthly[0]?.ym})=100 지수`
                    : "단위: US$/U (품목별 집적도가 다르므로 지수화·증가율 비교 권장)",
                data: seriesPrice,
                formatter: (v: number) =>
                  modeA === "yoy"
                    ? `${v.toFixed(0)}%`
                    : modeA === "index"
                    ? v.toFixed(0)
                    : `$${v.toFixed(0)}`,
                peakKey: "pricePeakYm" as const,
              },
            ].map((panel, pIdx) => (
              <div className="chart-panel" key={panel.title}>
                <div className="chart-title">
                  <div>{panel.title}</div>
                  <span>{panel.sub}</span>
                </div>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={panel.data}
                      onMouseMove={(state) => {
                        if (state?.activeLabel) setHoveredYm(String(state.activeLabel));
                      }}
                      margin={{ top: 10, right: 20, left: 6, bottom: 4 }}
                    >
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="2 5" vertical={false} />
                      <XAxis
                        dataKey="ym"
                        minTickGap={48}
                        tickFormatter={(v) => String(v).slice(0, 4)}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                      />
                      <YAxis
                        scale={logScaleA && modeA === "level" ? "log" : "auto"}
                        domain={["auto", "auto"]}
                        tickFormatter={panel.formatter}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        width={58}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {modeA === "yoy" && <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />}
                      {modeA === "index" && <ReferenceLine y={100} stroke="#64748b" strokeDasharray="3 3" />}
                      {ITEMS.map((k) => {
                        if (singleItemView && highlightItem !== "ALL" && highlightItem !== k) {
                          return null;
                        }
                        const isDimmed = highlightItem !== "ALL" && highlightItem !== k;
                        const singleMetricColor =
                          singleItemView && highlightItem === k
                            ? pIdx === 0
                              ? "#2f6df6"
                              : pIdx === 1
                              ? "#16a36a"
                              : "#f08a24"
                            : itemMeta[k].color;
                        return (
                          <Line
                            key={k}
                            type="monotone"
                            dataKey={k}
                            name={itemMeta[k].name}
                            stroke={singleMetricColor}
                            strokeWidth={highlightItem === k ? 3 : isDimmed ? 1.3 : 2.2}
                            strokeOpacity={isDimmed ? 0.18 : 1}
                            strokeDasharray={!singleItemView ? itemMeta[k].dashArray : undefined}
                            dot={false}
                            isAnimationActive={false}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
          <div className="chart-takeaway">
            <b>핵심 관찰</b>
            <span>
              수출금액(상단)은 3차례 슈퍼사이클마다 계단식으로 도약했으나, 신고수량(중단)은 2021~23년 정점 이후 완만하거나 감소 추세입니다.
            </span>
          </div>

          {/* Collapsible Deep-Dive: Industrial Roles & HSK Scope Architecture */}
          <details className="deep-dive-drawer">
            <summary>
              <span>🔍 3대 품목의 산업적 역할 및 HSK 통관 분류 기준 주의사항 (복합구조칩 ≠ HBM 전용)</span>
            </summary>
            <div className="deep-dive-body">
              <div className="three-item-grid" style={{ margin: 0 }}>
                <div className="narrative-box" style={{ borderTop: "4px solid #2f6df6", padding: 16 }}>
                  <span className="narrative-tag" style={{ background: "#e0ebff", color: "#1d4ed8" }}>
                    HSK 8542.32-1010 · 휘발성 주메모리
                  </span>
                  <h4>① D램 (DRAM)</h4>
                  <ul className="compact-bullets">
                    <li><b>역할:</b> CPU·GPU 연산용 초고속 주메모리 (서버 DDR5 탑재량 급증)</li>
                    <li><b>특징:</b> 수량(+1.5%)은 정체했으나 단가가 $24.55(+522.5%)로 폭등</li>
                  </ul>
                </div>

                <div className="narrative-box" style={{ borderTop: "4px solid #16a36a", padding: 16 }}>
                  <span className="narrative-tag" style={{ background: "#dcfce7", color: "#15803d" }}>
                    HSK 8542.32-1030 · 비휘발성 저장 메모리
                  </span>
                  <h4>② 플래시 메모리 (Flash)</h4>
                  <ul className="compact-bullets">
                    <li><b>역할:</b> AI 데이터셋·벡터 DB 저장용 비휘발성 메모리</li>
                    <li><b>주의:</b> 단품 NAND·NOR 포함 (완제품 SSD는 HSK 8471.70 별도 집계)</li>
                  </ul>
                </div>

                <div className="narrative-box" style={{ borderTop: "4px solid #8b5cf6", padding: 16 }}>
                  <span className="narrative-tag" style={{ background: "#f3e8ff", color: "#6d28d9" }}>
                    HSK 8542.32-3000 · 다중칩·적층 기억소자
                  </span>
                  <h4>③ 복합구조칩 (MCP)</h4>
                  <ul className="compact-bullets">
                    <li><b>역할:</b> 복수의 메모리 다이를 단일 패키지에 결합한 고집적 칩</li>
                    <li style={{ color: "#b91c1c" }}><b>주의:</b> 고적층 메모리가 일부 포함될 수 있으나 <b>HBM 전용 코드가 아님</b></li>
                  </ul>
                </div>
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* ACT 04. D램 한 개의 평균 단가가 6배가 된 이유 (시각화 B & 한국은행 수출물가지수 교차 검증) */}
      <section id="act4" className="section warm">
        <div className="container wide">
          <SectionHeader
            act="ACT 04"
            eyebrow="VISUALIZATION B & BOK EXPORT PRICE INDEX CROSS-VALIDATION"
            title="D램 한 개의 평균 단가가 6배가 된 이유"
            copy="2025년 9월=100 단가지수 추이와 한국은행 공식 수출물가지수(ECOS)를 교차 검증합니다."
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: 22 }}>
            {/* Visualization B: 2025.09 = 100 Price Surge Index */}
            <div className="chart-stack" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="chart-panel">
                <div className="chart-title">
                  <div>
                    <TrendingUp size={16} color="#2f6df6" />
                    시각화 B — 단가 폭등 경로 비교 ({indexBaseYm} = 100 지수화)
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[
                      ["2025-09=100 (최근 1년)", "2025-09"],
                      ["2024-01=100", "2024-01"],
                      ["2023-03=100 (저점)", "2023-03"],
                    ].map(([lbl, ymVal]) => (
                      <button
                        key={ymVal}
                        onClick={() => setIndexBaseYm(ymVal)}
                        style={{
                          padding: "4px 9px",
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 3,
                          border: "1px solid #cbd5e1",
                          background: indexBaseYm === ymVal ? "#0d1d33" : "#fff",
                          color: indexBaseYm === ymVal ? "#fff" : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceSurgeData} margin={{ top: 14, right: 24, left: 4, bottom: 8 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="ym" minTickGap={28} tick={{ fill: "#64748b", fontSize: 11.5 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11.5 }} width={52} />
                      <Tooltip content={<CustomTooltip unitSuffix=" (지수)" />} />
                      <Legend />
                      <ReferenceLine y={100} stroke="#475569" strokeDasharray="4 4" label={{ value: `${indexBaseYm}=100`, position: "insideTopLeft", fontSize: 11 }} />
                      <Line type="monotone" dataKey="DRAM" name="D램 단가지수 (26.09: 622.5)" stroke="#2f6df6" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="FLASH" name="플래시 단가지수 (26.09: 523.1)" stroke="#16a36a" strokeWidth={2.5} strokeDasharray="6 3" dot={false} />
                      <Line type="monotone" dataKey="MCP" name="복합구조칩 단가지수 (26.09: 394.5)" stroke="#8b5cf6" strokeWidth={2.5} strokeDasharray="2 2" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-takeaway">
                <b>상승 속도</b>
                <span>
                  2025.09=100 기준 <b>D램(622.6) → 플래시(523.1) → 복합구조칩(394.5)</b> 순으로 최근 1년 상승 탄력이 가팔랐습니다.
                </span>
              </div>
            </div>

            {/* BOK Export Price Index Cross-Validation */}
            <div className="chart-stack" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="chart-panel">
                <div className="chart-title">
                  <div>
                    <Database size={16} color="#f08a24" />
                    교차 검증 — 통관 평균단가 vs 한국은행 수출물가지수 (2021.01=100)
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      ["D램 비교", "DRAM"],
                      ["플래시 비교", "FLASH"],
                      ["전체 무역지수", "MACRO"],
                    ].map(([lbl, key]) => (
                      <button
                        key={key}
                        onClick={() => setBokCompareItem(key as typeof bokCompareItem)}
                        style={{
                          padding: "4px 9px",
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 3,
                          border: "1px solid #cbd5e1",
                          background: bokCompareItem === key ? "#0d1d33" : "#fff",
                          color: bokCompareItem === key ? "#fff" : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        {lbl}
                      </button>
                    ))}
                    {bokCompareItem !== "MACRO" && (
                      <select
                        value={bokCurrencyMode}
                        onChange={(e) => setBokCurrencyMode(e.target.value as "usd" | "krw")}
                        style={{ fontSize: 11, padding: "3px 6px", border: "1px solid #cbd5e1" }}
                      >
                        <option value="usd">한은: 달러/계약통화</option>
                        <option value="krw">한은: 원화 기준</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    {bokCompareItem === "MACRO" ? (
                      <LineChart
                        data={payload.bok_macro_trade.bok_trade_indices_monthly}
                        margin={{ top: 14, right: 20, left: 4, bottom: 8 }}
                      >
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="ym" tick={{ fill: "#64748b", fontSize: 11.5 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 11.5 }} width={50} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line type="monotone" dataKey="exp_val_idx" name="한국은행 수출금액지수 (2020=100)" stroke="#2f6df6" strokeWidth={2.8} dot={false} />
                        <Line type="monotone" dataKey="exp_vol_idx" name="한국은행 수출물량지수 (2020=100)" stroke="#16a36a" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="net_tot_idx" name="순상품교역조건지수 (2020=100)" stroke="#f08a24" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    ) : (
                      <LineChart data={bokCrossData} margin={{ top: 14, right: 20, left: 4, bottom: 8 }}>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="ym" minTickGap={24} tick={{ fill: "#64748b", fontSize: 11.5 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 11.5 }} width={52} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <ReferenceLine y={100} stroke="#64748b" strokeDasharray="3 3" />
                        {bokCompareItem === "DRAM" ? (
                          <>
                            <Line
                              type="monotone"
                              dataKey="dramCustomsIdx"
                              name="관세청 D램 통관 개당단가 지수 (21.01=100)"
                              stroke="#2f6df6"
                              strokeWidth={3}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="dramBokIdx"
                              name={`한국은행 D램 수출물가지수 (${
                                bokCurrencyMode === "usd" ? "달러" : "원화"
                              })`}
                              stroke="#f08a24"
                              strokeWidth={2.6}
                              strokeDasharray="5 3"
                              dot={false}
                              connectNulls
                            />
                          </>
                        ) : (
                          <>
                            <Line
                              type="monotone"
                              dataKey="flashCustomsIdx"
                              name="관세청 플래시 통관 개당단가 지수 (21.01=100)"
                              stroke="#16a36a"
                              strokeWidth={3}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="flashBokIdx"
                              name={`한국은행 플래시 수출물가지수 (${
                                bokCurrencyMode === "usd" ? "달러" : "원화"
                              })`}
                              stroke="#f08a24"
                              strokeWidth={2.6}
                              strokeDasharray="5 3"
                              dot={false}
                              connectNulls
                            />
                          </>
                        )}
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-takeaway">
                <b>지수 격차 이유</b>
                <span>
                  한은 지수(동일 규격 순수가격)보다 통관단가(고용량·고부가 믹스 포함 전수 평균)의 상승폭이 더 크게 나타납니다.
                </span>
              </div>
            </div>
          </div>

          <details className="deep-dive-drawer">
            <summary>
              <span>📊 관세청 통관 평균단가(+418.1%)와 한국은행 수출물가지수(+238.2%) 차이의 통계적 배경</span>
            </summary>
            <div className="deep-dive-body">
              <ul className="compact-bullets">
                <li><b>① 품질 고정 vs 제품 믹스 반영:</b> 한국은행 수출물가지수는 특정 대표 규격의 순수 계약가격만 추적(품질 조정)하는 반면, 관세청 통관단가는 고용량·고부가 제품 비중 변화를 모두 포함한 전수 평균입니다.</li>
                <li><b>② 시차 및 환율:</b> 계약시점(한국은행)과 통관시점(관세청)의 시차가 존재하므로 두 지수의 격차 전체를 임의로 ‘고도화 효과’로 단정할 수 없습니다.</li>
              </ul>
            </div>
          </details>
        </div>
      </section>

      {/* ACT 05. AI가 반도체 산업의 수요와 공급을 바꿨다 (경제적 메커니즘 & 6대 핵심 질문) */}
      <section id="act5" className="section">
        <div className="container wide">
          <SectionHeader
            act="ACT 05"
            eyebrow="AI SUPPLY-DEMAND MECHANISM & 6 KEY QUESTIONS"
            title="AI가 반도체 산업의 수요와 공급을 바꿨다"
            copy="AI 데이터센터 증설과 HBM 웨이퍼 할당(다이 페널티)이 어떻게 범용 메모리 공급 부족과 단가 폭등을 불렀는지 5단계로 요약합니다."
          />

          {/* Compact 5-Step Economic Mechanism Graphic */}
          <div className="mechanism-flow">
            <div className="mech-step">
              <span>STEP 01 · 수요 충격</span>
              <h4>빅테크 AI 인프라 경쟁</h4>
              <p>AI 학습·추론 비용의 70~80%를 차지하는 AI 칩·메모리 선점 경쟁</p>
            </div>
            <div className="mech-step">
              <span>STEP 02 · 다이 페널티</span>
              <h4>HBM의 3배 웨이퍼 잠식</h4>
              <p>동일 용량 기준 DDR5 대비 약 3배 웨이퍼 소요 → 전체 출하 개수(U) 제약</p>
            </div>
            <div className="mech-step">
              <span>STEP 03 · 풍선 효과</span>
              <h4>범용 D램·낸드 공급 축소</h4>
              <p>선단 공정이 고부가 라인으로 전환되며 범용 메모리까지 연쇄 공급 부족</p>
            </div>
            <div className="mech-step">
              <span>STEP 04 · 통관 지표</span>
              <h4>수량 정체 · 단가 폭등</h4>
              <p>2026.09 수량은 정체·감소(+1.5%~-27.3%), 평균단가는 3~6배 급등</p>
            </div>
            <div className="mech-step">
              <span>STEP 05 · 거시 파급</span>
              <h4>교역조건 · GDI 사상 최대</h4>
              <p>수출물가 상승이 교역조건(+24.7%)과 실질 GDI(+13.2%) 급등 견인</p>
            </div>
          </div>

          {/* 6 Key Questions as Interactive Accordions */}
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "24px 0 10px" }}>
            핵심 6대 질문 Q&A
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 10 }}>
            {SIX_KEY_QUESTIONS.map((item) => (
              <details key={item.num} className="deep-dive-drawer" style={{ marginTop: 0 }}>
                <summary style={{ padding: "13px 16px" }}>
                  <strong style={{ fontSize: 14, color: "var(--ink)", textAlign: "left", paddingRight: 10 }}>
                    {item.num}. {item.question}
                  </strong>
                </summary>
                <div className="deep-dive-body" style={{ fontSize: 13, color: "#334155" }}>
                  <div style={{ marginBottom: 8, fontWeight: 700, color: "#1e293b" }}>
                    📌 {item.factSummary}
                  </div>
                  <div>{item.analysis}</div>
                </div>
              </details>
            ))}
          </div>

          <QuoteSection actId="act5" />
        </div>
      </section>

      {/* ACT 06. 2018년과 2022년에는 무슨 일이 있었나 (시각화 D: 과거 슈퍼사이클 비교) */}
      <section id="act6" className="section pale">
        <div className="container wide">
          <SectionHeader
            act="ACT 06"
            eyebrow="VISUALIZATION D · SUPERCYCLE COMPARISON (2017–18 vs 2021–22 vs 2024–26)"
            title="역대 반도체 슈퍼사이클 3대 국면 비교"
            copy="2017–18, 2021–22, 2024–26 세 번의 슈퍼사이클 상승 속도와 품목별 고점 도달 순서를 비교합니다."
          />

          <div className="control-bar" style={{ background: "#fff" }}>
            <div className="item-filter-pills">
              {ITEMS.map((k) => (
                <button
                  key={k}
                  className={`item-pill ${cycleItemFilter === k ? "active" : ""}`}
                  onClick={() => setCycleItemFilter(k)}
                  style={
                    cycleItemFilter === k
                      ? { background: itemMeta[k].color, borderColor: itemMeta[k].color, color: "#fff" }
                      : {}
                  }
                >
                  <i style={{ background: cycleItemFilter === k ? "#fff" : itemMeta[k].color }} />
                  {itemMeta[k].name} 사이클 비교
                </button>
              ))}
            </div>
            <div className="segmented">
              {[
                ["개당 평균단가 (US$/U)", "usd_per_U"],
                ["월별 수출금액 (US$)", "export_usd"],
                ["월별 신고수량 (U)", "export_units_U"],
              ].map(([lbl, mKey]) => (
                <button
                  key={mKey}
                  className={cycleMetricFilter === mKey ? "active" : ""}
                  onClick={() => setCycleMetricFilter(mKey as ItemMetric)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 20 }}>
            <div className="chart-stack" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="chart-panel">
                <div className="chart-title">
                  <div>
                    [{itemMeta[cycleItemFilter].name}] 3대 슈퍼사이클 궤적 (구간 시작월 = 100)
                  </div>
                  <span>가로축: 경과 개월(0~39개월)</span>
                </div>
                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={supercycleOverlay} margin={{ top: 14, right: 24, left: 4, bottom: 16 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="monthOffset"
                        label={{ value: "비교 구간 시작 후 경과 개월 (Month)", position: "insideBottom", offset: -8, fontSize: 12 }}
                      />
                      <YAxis tickFormatter={(v) => `${v}`} width={52} />
                      <Tooltip content={<CustomTooltip unitSuffix=" (시작=100)" />} />
                      <Legend />
                      <ReferenceLine y={100} stroke="#64748b" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="2017–18 클라우드" stroke="#64748b" strokeWidth={2.2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="2021–22 팬데믹" stroke="#2f6df6" strokeWidth={2.2} strokeDasharray="5 3" dot={false} connectNulls />
                      <Line type="monotone" dataKey="2024–26 AI 슈퍼사이클" stroke="#f08a24" strokeWidth={3.2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-takeaway">
                <b>읽는 법</b>
                <span>
                  2024~26 AI 사이클(주황)은 25개월차 이후 과거 두 사이클을 압도하는 기울기로 수직 상승했습니다(현재 진행 중).
                </span>
              </div>
            </div>

            {/* Cycle Quantitative Comparison Table */}
            <div className="table-wrap" style={{ maxHeight: "none" }}>
              <table style={{ minWidth: "100%" }}>
                <thead>
                  <tr>
                    <th>사이클 / 품목</th>
                    <th>단가 저점→고점</th>
                    <th>상승기간 / 상승폭</th>
                    <th>고점 후 하락률</th>
                    <th>전고점 회복</th>
                    <th>단가-수량 시차</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["2017–18", "cycle_2017_2018"],
                    ["2021–22", "cycle_2021_2022"],
                    ["2024–26*", "cycle_2024_2026"],
                  ].map(([cLabel, cKey]) =>
                    ITEMS.map((k) => {
                      const st = payload.cycles_analysis[cKey][k];
                      const isSel = k === cycleItemFilter;
                      return (
                        <tr
                          key={`${cKey}-${k}`}
                          style={isSel ? { background: itemMeta[k].lightBg, fontWeight: 700 } : {}}
                        >
                          <td>
                            <b>{cLabel}</b> · <span style={{ color: itemMeta[k].color }}>{itemMeta[k].shortName}</span>
                          </td>
                          <td>
                            {st.start_trough_ym}(${st.start_trough_usd_per_U.toFixed(2)}) →{" "}
                            <b>{st.peak_price_ym}(${st.peak_usd_per_U.toFixed(2)})</b>
                          </td>
                          <td className="positive">
                            {st.upturn_duration_months}개월 (+{st.upturn_gain_pct.toFixed(0)}%)
                          </td>
                          <td className="negative">
                            {cKey === "cycle_2024_2026"
                              ? "진행 중"
                              : `${st.post_peak_drawdown_pct.toFixed(1)}% (${st.post_peak_trough_ym})`}
                          </td>
                          <td>
                            {st.recovery_months_from_peak != null
                              ? `${st.recovery_months_from_peak}개월 (${st.recovery_ym})`
                              : "진행 중"}
                          </td>
                          <td>
                            {st.price_to_units_peak_lag_months === 0
                              ? "동행 (0개월)"
                              : st.price_to_units_peak_lag_months > 0
                              ? `단가 ${st.price_to_units_peak_lag_months}개월 선행`
                              : `수량 ${Math.abs(st.price_to_units_peak_lag_months)}개월 선행`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <div style={{ padding: "12px 14px", background: "#f8fafc", fontSize: 12, color: "#334155", borderTop: "1px solid var(--line)" }}>
                <b>🔍 고점 도달 순서 검증:</b> <b>2017–18</b>(플래시→MCP→D램) vs <b>2021–22</b>(D램→MCP→플래시) vs <b>2024–26</b>(MCP 전고점 선 돌파 후 동반 강세) — <b>순서는 고정되어 있지 않으며 수요 동인에 따라 달라집니다.</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ACT 07. 반도체 호황이 한국 경제에 미치는 영향 (한국은행 BOK 이슈노트 2026-16 & 2026-20) */}
      <section id="act7" className="section">
        <div className="container wide">
          <SectionHeader
            act="ACT 07"
            eyebrow="MACROECONOMIC IMPACT · BANK OF KOREA ISSUE NOTE 2026-16 & 2026-20"
            title="사상 최대 GDI-GDP 격차(+9.4%p)와 ‘호황의 역설’"
            copy="한국은행 조사국 연구를 통해 반도체 가격 급등이 국가소득(GDI), 기업 이익 양극화, 내수 파급에 미친 영향을 분석합니다."
          />

          {/* 2 Charts: Quarterly GDP vs GDI + Operating Profit Polarization */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 20, marginBottom: 20 }}>
            <div className="chart-stack" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="chart-panel">
                <div className="chart-title">
                  <div>
                    [한국은행] 실질 GDP vs 실질 GDI 성장률 및 격차 (2026.1Q +9.4%p)
                  </div>
                  <span>단위: 전년동기대비(%, %p)</span>
                </div>
                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={payload.bok_macro_trade.quarterly_gdp_gdi}
                      margin={{ top: 14, right: 20, left: 4, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="quarter" tick={{ fill: "#1e293b", fontWeight: 700, fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#64748b", fontSize: 11.5 }} width={48} />
                      <Tooltip content={<CustomTooltip unitSuffix="%" />} />
                      <Legend />
                      <Bar dataKey="real_gdp" name="실질 GDP 성장률(%)" fill="#64748b" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="real_gdi" name="실질 GDI 증가율(%)" fill="#2f6df6" radius={[3, 3, 0, 0]} />
                      <Line type="monotone" dataKey="gap_gdi_gdp" name="GDI-GDP 격차(%p)" stroke="#f08a24" strokeWidth={3} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-takeaway">
                <b>교역조건 효과</b>
                <span>
                  2026.1Q 실질 GDP는 <b>+3.8%</b> 성장했으나 반도체 가격 급등에 따른 무역이익으로 실질 GDI는 <b>+13.2%</b> 급증했습니다.
                </span>
              </div>
            </div>

            <div className="chart-stack" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="chart-panel">
                <div className="chart-title">
                  <div>
                    [한국은행·FnGuide] 상장기업 영업이익 추이 및 2026년 컨센서스
                  </div>
                  <span>단위: 조 원 (연결 기준)</span>
                </div>
                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={payload.bok_macro_trade.it_spillover_metrics.operating_profit_krw_trillion}
                      margin={{ top: 14, right: 20, left: 4, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: "#1e293b", fontWeight: 700, fontSize: 12.5 }} />
                      <YAxis tickFormatter={(v) => `${v}조`} tick={{ fill: "#64748b", fontSize: 11.5 }} width={52} />
                      <Tooltip content={<CustomTooltip unitSuffix="조 원" />} />
                      <Legend />
                      <ReferenceLine y={0} stroke="#475569" />
                      <Bar dataKey="samsung_skh" name="삼성전자 · SK하이닉스 합산(조 원)" fill="#2f6df6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="others" name="그 외 상장기업 전체(조 원)" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-takeaway">
                <b>K자형 양극화</b>
                <span>
                  삼성·SK하이닉스 영업이익 전망은 <b>639조 원</b>으로 폭증한 반면, 비IT 상장사 회복은 완만한 양극화가 나타납니다.
                </span>
              </div>
            </div>
          </div>

          {/* Compact 3 Structural Constraint Cards */}
          <div className="three-item-grid">
            <div className="narrative-box" style={{ padding: 18 }}>
              <span className="narrative-tag" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                제약 1 · 고용·설비 낙수효과 한계
              </span>
              <h4>제조업 비중 51% vs 고용 비중 2.6%</h4>
              <ul className="compact-bullets">
                <li>IT 제조업 취업유발계수 <b>3.6명</b> (전산업 8.2명)</li>
                <li>반도체 장비 투자 <b>60% 수입 의존</b>으로 파급 일부 유출</li>
              </ul>
            </div>

            <div className="narrative-box" style={{ padding: 18 }}>
              <span className="narrative-tag" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                제약 2 · 수혜지역 소비와 MPC 한계
              </span>
              <h4>이천·화성·청주 소비 +4% (누적 1.1조 원)</h4>
              <ul className="compact-bullets">
                <li>성과급 이후 수혜지역 카드소비 최대 <b>+4%</b> 증가 (BOK 2026-20)</li>
                <li>고자산층 낮은 한계소비성향(MPC 0.01)으로 전국 확산은 완만</li>
              </ul>
            </div>

            <div className="narrative-box" style={{ padding: 18 }}>
              <span className="narrative-tag" style={{ background: "#fef3c7", color: "#b45309" }}>
                역설 3 · 거시·통화정책 영향
              </span>
              <h4>소득·세수 급증과 수요측 물가 압력</h4>
              <ul className="compact-bullets">
                <li>GDI 급증·세수 확대(상관계수 0.55)로 거시 유동성 유입</li>
                <li>수요측 물가·수도권 주택가격 압력으로 통화정책 긴축 요인 작용</li>
              </ul>
            </div>
          </div>

          <details className="deep-dive-drawer">
            <summary>
              <span>📋 역대 4대 교역조건 개선기(2009 · 2015–16 · 2020 · 2026.1Q) 비교표 보기</span>
            </summary>
            <div className="deep-dive-body" style={{ padding: 0 }}>
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>교역조건 개선기</th>
                      <th>주도 형태</th>
                      <th>핵심 동인</th>
                      <th>수출물가 증감률</th>
                      <th>수입물가 증감률</th>
                      <th>실질 GDP</th>
                      <th>실질 GDI</th>
                      <th>GDI − GDP 격차</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.bok_macro_trade.terms_of_trade_episodes.map((ep) => (
                      <tr
                        key={ep.period}
                        style={ep.period.includes("2026") ? { background: "#eff6ff", fontWeight: 700 } : {}}
                      >
                        <td><b>{ep.period}</b></td>
                        <td>{ep.driver_type}</td>
                        <td style={{ textAlign: "left" }}>{ep.main_cause}</td>
                        <td className={ep.export_price_yoy >= 0 ? "positive" : "negative"}>
                          {formatPct(ep.export_price_yoy, 1)}
                        </td>
                        <td className={ep.import_price_yoy >= 0 ? "positive" : "negative"}>
                          {formatPct(ep.import_price_yoy, 1)}
                        </td>
                        <td>{ep.gdp_growth.toFixed(1)}%</td>
                        <td style={{ fontWeight: 800, color: "#2f6df6" }}>{ep.gdi_growth.toFixed(1)}%</td>
                        <td style={{ fontWeight: 800, color: "#d97706" }}>+{ep.gdi_gdp_gap.toFixed(1)}%p</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          <QuoteSection actId="act7" />
        </div>
      </section>

      {/* ACT 08. 2027년에도 슈퍼사이클은 이어질까 */}
      <section id="act8" className="section warm">
        <div className="container wide">
          <SectionHeader
            act="ACT 08"
            eyebrow="OUTLOOK FOR 2027 & VALUE CHAIN VULNERABILITIES"
            title="2027년에도 슈퍼사이클은 이어질까"
            copy="메모리 초격차(65.6%) 이면의 비메모리·패키징 취약점과 2027년 양방향 시나리오를 점검합니다."
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 20 }}>
            <div className="chart-stack" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="chart-panel">
                <div className="chart-title">
                  <div>
                    글로벌 반도체 밸류체인별 국가 점유율 비교 (2025)
                  </div>
                  <span>단위: % · 출처: 관계부처 합동 반도체산업 전략</span>
                </div>
                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={payload.bok_macro_trade.it_spillover_metrics.value_chain_market_share_2025}
                      margin={{ top: 14, right: 20, left: 4, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="segment" tick={{ fill: "#1e293b", fontWeight: 700, fontSize: 12.5 }} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#64748b", fontSize: 11.5 }} width={48} />
                      <Tooltip content={<CustomTooltip unitSuffix="%" />} />
                      <Legend />
                      <Bar dataKey="korea" name="한국(%)" fill="#2f6df6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="us" name="미국(%)" fill="#64748b" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="taiwan" name="대만(%)" fill="#16a36a" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="china" name="중국(%)" fill="#f08a24" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-takeaway">
                <b>밸류체인 불균형</b>
                <span>
                  메모리(<b>65.6%</b>)는 압도적 1위이나, 팹리스(<b>0.8%</b>)·파운드리(<b>9.8%</b>)·패키징(<b>4.5%</b>) 및 소부장 자립률(30%)이 과제입니다.
                </span>
              </div>
            </div>

            <div className="chart-stack" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="chart-panel">
                <div className="chart-title">
                  <div>
                    삼성전자 · SK하이닉스 CapEx 전망 및 2027년 양방향 시나리오
                  </div>
                  <span>단위: 조 원 · 출처: BOK 이슈노트 2026-16</span>
                </div>
                <div style={{ padding: "12px 8px" }}>
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={payload.bok_macro_trade.it_spillover_metrics.capex_samsung_skh_krw_trillion}
                        layout="vertical"
                        margin={{ top: 6, right: 30, left: 20, bottom: 6 }}
                      >
                        <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => `${v}조`} />
                        <YAxis type="category" dataKey="year" width={60} fontWeight={700} />
                        <Tooltip content={<CustomTooltip unitSuffix="조 원" />} />
                        <Bar dataKey="capex" name="삼성·SKH 합산 CapEx(조 원)" fill="#8b5cf6" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                    <div style={{ padding: 12, background: "#eff6ff", borderRadius: 4, fontSize: 12 }}>
                      <b style={{ color: "#1d4ed8", display: "block", marginBottom: 4 }}>
                        ▲ 2027 상승 지속 요인 (Trend)
                      </b>
                      • 에이전틱·피지컬 AI 인프라 경쟁
                      <br />• HBM4 전환에 따른 다이 페널티 심화
                      <br />• CapEx 75조(25) → 150조(27e) 확대
                    </div>
                    <div style={{ padding: 12, background: "#fff1f2", borderRadius: 4, fontSize: 12 }}>
                      <b style={{ color: "#be123c", display: "block", marginBottom: 4 }}>
                        ▼ 2027 조정 리스크 (Cycle)
                      </b>
                      • 재고증가율 플러스(+) 전환 가능성
                      <br />• 대규모 신규 팹 가동 후 수급 완화
                      <br />• 고금리 장기화 및 관세·공급망 리스크
                    </div>
                  </div>
                </div>
              </div>
              <div className="chart-takeaway">
                <b>전망 원칙</b>
                <span>
                  과거 20년간 영원히 오른 사이클은 없었으며, 2027년 경로는 신규 팹 가동 시점과 AI 수익화 속도에 달려 있습니다.
                </span>
              </div>
            </div>
          </div>

          <QuoteSection actId="act8" />
        </div>
      </section>

      {/* ACT 09. 20년의 데이터가 보여주는 다음 신호 (시차 상관 & 역사적 기록) */}
      <section id="act9" className="section pale">
        <div className="container wide">
          <SectionHeader
            act="ACT 09"
            eyebrow="LEAD & LAG SIGNALS AND 20-YEAR RECORDS"
            title="가격·수량 시차 상관과 237개월 역대 기록"
            copy="품목별 단가·수량 증감률의 시차(Lead & Lag) 상관계수와 역대 최고·최저 기록을 확인합니다."
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 20, marginBottom: 28 }}>
            <div style={{ background: "#fff", border: "1px solid var(--line)", padding: 22, borderRadius: 4 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {ITEMS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setLagItem(k)}
                    style={{
                      padding: "6px 13px",
                      borderRadius: 4,
                      border: `1px solid ${lagItem === k ? itemMeta[k].color : "#cbd5e1"}`,
                      background: lagItem === k ? itemMeta[k].color : "#fff",
                      color: lagItem === k ? "#fff" : "#334155",
                      fontWeight: 750,
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    {itemMeta[k].name}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 650 }}>시차(Lag) 슬라이더</span>
                  <b>
                    {lagMonths === 0
                      ? "동행 (0개월)"
                      : lagMonths > 0
                      ? `단가 변화 ${lagMonths}개월 선행`
                      : `수량 변화 ${Math.abs(lagMonths)}개월 선행`}
                  </b>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  value={lagMonths}
                  onChange={(e) => setLagMonths(Number(e.target.value))}
                  style={{ width: "100%", accentColor: itemMeta[lagItem].color }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
                  <span>-12개월 (수량 선행)</span>
                  <span>0 (동행)</span>
                  <span>+12개월 (단가 선행)</span>
                </div>
              </div>

              <div style={{ background: "#0d1d33", color: "#fff", padding: 20, borderRadius: 4 }}>
                <span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 700 }}>
                  [{itemMeta[lagItem].name}] 단가 YoY vs 수량 YoY 상관계수 (r)
                </span>
                <div style={{ fontSize: 50, fontWeight: 850, color: "#7fa8ff", lineHeight: 1.1, margin: "8px 0" }}>
                  {lagResult.correlation != null ? lagResult.correlation.toFixed(2) : "—"}
                </div>
                <small style={{ color: "#94a3b8", display: "block" }}>
                  표본: {lagResult.n}개월 · 공급 제약기에는 수량 둔화와 단가 급등이 동시 발생해 음(-)의 상관이 나타납니다.
                </small>
              </div>
            </div>

            <div className="chart-stack" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="chart-panel">
                <div className="chart-title">
                  <div>
                    [{itemMeta[lagItem].name}] 평균단가 증감률(X축) vs 신고수량 증감률(Y축) 산점도
                  </div>
                  <span>단위: 전년 동월 대비(%)</span>
                </div>
                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 16, right: 20, bottom: 24, left: 10 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="price"
                        name="단가 YoY"
                        unit="%"
                        label={{ value: "개당 평균단가 증감률(%)", position: "insideBottom", offset: -12, fontSize: 12 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="units"
                        name="수량 YoY"
                        unit="%"
                        label={{ value: "신고수량 증감률(%)", angle: -90, position: "insideLeft", fontSize: 12 }}
                      />
                      <ZAxis range={[28, 28]} />
                      <ReferenceLine x={0} stroke="#64748b" />
                      <ReferenceLine y={0} stroke="#64748b" />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter
                        data={lagResult.pairs.map(([price, units]) => ({
                          price: Number(price.toFixed(1)),
                          units: Number(units.toFixed(1)),
                        }))}
                        fill={itemMeta[lagItem].color}
                        fillOpacity={0.6}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* 12 Historical High/Low Record Cards */}
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
            237개월 3대 품목 역대 최고·최저 기록 (클릭 시 시계열 이동)
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: 10,
            }}
          >
            {historicalExtremes.map((card, i) => (
              <a
                key={`${card.item}-${card.label}`}
                href="#act3"
                onClick={() => {
                  setUseCustomRange(false);
                  setRangeMonths(237);
                  setHighlightItem(card.item);
                  setHoveredYm(card.ym);
                }}
                style={{
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderLeft: `4px solid ${itemMeta[card.item].color}`,
                  padding: "14px 16px",
                  textDecoration: "none",
                  color: "var(--ink)",
                  borderRadius: 4,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
                  <span>RECORD #{String(i + 1).padStart(2, "0")}</span>
                  <b style={{ color: itemMeta[card.item].color }}>{card.ym}</b>
                </div>
                <span style={{ fontSize: 12.5, color: "#475569", fontWeight: 650 }}>{card.label}</span>
                <strong style={{ fontSize: 20, letterSpacing: "-0.03em" }}>{card.display}</strong>
                <small style={{ fontSize: 11, color: "#64748b" }}>{card.sub}</small>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 부록. 반도체 데이터 실험실 & 12대 데이터 검증 리포트 */}
      <section id="lab" className="section">
        <div className="container wide">
          <SectionHeader
            act="APPENDIX"
            eyebrow="DATA LAB & 12-POINT QUALITY VALIDATION"
            title="부록: 반도체 데이터 실험실 (711개 관측치)"
            copy="3개 품목 237개월 원자료를 검색·필터링하고 전체 CSV로 내려받을 수 있습니다."
          />

          <div className="control-bar">
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#fff",
                  border: "1px solid #cbd5e1",
                  padding: "6px 12px",
                  borderRadius: 4,
                }}
              >
                <Search size={15} color="#64748b" />
                <input
                  value={labSearch}
                  onChange={(e) => setLabSearch(e.target.value)}
                  placeholder="연월 검색 (예: 2026-09, 2018)"
                  style={{ border: 0, outline: 0, fontSize: 13, minWidth: 210 }}
                />
              </label>

              <div className="segmented">
                <button
                  className={labItemFilter === "ALL" ? "active" : ""}
                  onClick={() => setLabItemFilter("ALL")}
                >
                  전체 (711행)
                </button>
                {ITEMS.map((k) => (
                  <button
                    key={k}
                    className={labItemFilter === k ? "active" : ""}
                    onClick={() => setLabItemFilter(k)}
                  >
                    {itemMeta[k].name} (237행)
                  </button>
                ))}
              </div>
            </div>

            <button
              className="icon-button"
              style={{ background: "#0d1d33", color: "#fff", borderColor: "#0d1d33" }}
              onClick={() =>
                downloadThreeItemsCsv(
                  monthly,
                  "반도체_3품목_월별_수출입_가격수량_2007-2026.csv"
                )
              }
            >
              <ArrowDownToLine size={15} /> 전체 711개 관측치 CSV 다운로드
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>연월</th>
                  <th>품목 (HSK)</th>
                  <th>수출금액 (US$)</th>
                  <th>신고수량 (U)</th>
                  <th>개당 평균단가 ($/U)</th>
                  <th>kg당 평균단가 ($/kg)</th>
                  <th>수출중량 (g)</th>
                  <th>수출액 YoY</th>
                  <th>수량 YoY</th>
                  <th>개당단가 YoY</th>
                  <th>수입금액 (US$)</th>
                </tr>
              </thead>
              <tbody>
                {labRows.map((r) => (
                  <tr key={`${r.ym}-${r.category}`}>
                    <td>
                      <b>{r.ym}</b>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: itemMeta[r.category].color,
                          marginRight: 6,
                        }}
                      />
                      <b>{itemMeta[r.category].shortName}</b>{" "}
                      <small style={{ color: "#64748b" }}>({r.hsk})</small>
                    </td>
                    <td>${r.export_usd.toLocaleString()}</td>
                    <td>{r.export_units_U.toLocaleString()}</td>
                    <td>
                      <b>${r.usd_per_U.toFixed(2)}</b>
                    </td>
                    <td>${r.usd_per_kg.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}</td>
                    <td>{r.export_weight_g.toLocaleString()}</td>
                    <td className={(r.value_yoy_pct ?? 0) >= 0 ? "positive" : "negative"}>
                      {formatPct(r.value_yoy_pct, 1)}
                    </td>
                    <td className={(r.units_yoy_pct ?? 0) >= 0 ? "positive" : "negative"}>
                      {formatPct(r.units_yoy_pct, 1)}
                    </td>
                    <td className={(r.unit_value_yoy_pct ?? 0) >= 0 ? "positive" : "negative"}>
                      {formatPct(r.unit_value_yoy_pct, 1)}
                    </td>
                    <td>${r.import_usd.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Collapsible 12-Point Validation & Methodology Section */}
          <details id="method" className="deep-dive-drawer" style={{ marginTop: 20 }}>
            <summary>
              <span>✅ 데이터 품질 관리 12대 자동 검증 결과 및 공식 원출처 · 통계적 한계 보기</span>
            </summary>
            <div className="deep-dive-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                {VALIDATION_CHECKLIST.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      padding: "12px 14px",
                      borderRadius: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#15803d", display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={13} /> CHECK #{String(v.id).padStart(2, "0")} · {v.status}
                    </span>
                    <strong style={{ display: "block", fontSize: 13, margin: "3px 0" }}>{v.title}</strong>
                    <span style={{ fontSize: 11.5, color: "#475569" }}>{v.detail}</span>
                  </div>
                ))}
              </div>

              <div className="narrative-grid" style={{ margin: 0 }}>
                <div className="narrative-box" style={{ padding: 16 }}>
                  <h4>📚 공식 원출처 및 통계표 코드 (수집일: 2026-10-18)</h4>
                  <ul className="compact-bullets">
                    {payload.meta.sources.map((s) => (
                      <li key={s.name}>
                        <b>{s.name}</b>: {s.codes.join(" / ")}{" "}
                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2f6df6" }}>
                          [링크]
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="narrative-box" style={{ padding: 16 }}>
                  <h4>⚠️ 통계적 한계 요약</h4>
                  <ul className="compact-bullets">
                    <li><b>통관 평균단가:</b> 계약가격 상승과 고용량·고부가 믹스 효과가 함께 반영됨</li>
                    <li><b>신고수량(U):</b> 패키지·모듈 단위로 총 출하 비트(Bit)와 다를 수 있음</li>
                    <li><b>HBM 비식별:</b> 현행 HSK 10단위에는 HBM 전용 코드가 별도 분리되어 있지 않음</li>
                  </ul>
                </div>
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div>
          <a className="brand" href="#top">
            <span>CHIP</span> CYCLE
          </a>
          <p>
            한국 반도체 수출 20년의 구조 변화와 2026 AI 슈퍼사이클 인터랙티브 경제 다큐멘터리
            <br />
            원자료: 관세청 · 한국무역협회 K-stat · 한국은행 ECOS · BOK 이슈노트 (제2026-16호, 제2026-20호) · 관계부처 합동 반도체 전략
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#93c5fd", fontWeight: 700, marginBottom: 6 }}>
            VERIFIED DATASET · 711 OBSERVATIONS (2007.01–2026.09)
          </div>
          <a href="#top">맨 위로 이동 ↑</a>
        </div>
      </footer>
    </main>
  );
}
