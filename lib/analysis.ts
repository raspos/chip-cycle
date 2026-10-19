export type DramRecord = {
  ym: string;
  export_usd: number;
  export_units: number;
  export_weight_g: number;
  usd_per_unit: number;
  export_yoy_pct: number | null;
  units_yoy_pct: number | null;
  avg_value_yoy_pct: number | null;
  import_usd: number;
  import_units: number;
  import_weight_g: number;
};

export type Metric = "export_usd" | "export_units" | "usd_per_unit";

export type ItemKey = "DRAM" | "FLASH" | "MCP";

export type ItemMetric = "export_usd" | "export_units_U" | "usd_per_U" | "usd_per_kg";

export type ChipItemRecord = {
  ym: string;
  hsk: string;
  category: ItemKey;
  export_usd: number;
  export_units_U: number;
  export_weight_g: number;
  usd_per_U: number;
  usd_per_kg: number;
  units_yoy_pct: number | null;
  value_yoy_pct: number | null;
  unit_value_yoy_pct: number | null;
  kg_value_yoy_pct: number | null;
  import_usd: number;
  import_units_U: number;
  import_weight_g: number;
};

export type TotalSemiconRecord = {
  export_usd: number;
  export_weight_g: number;
  usd_per_kg: number | null;
  value_yoy_pct: number | null;
  weight_yoy_pct: number | null;
  kg_value_yoy_pct: number | null;
  import_usd: number;
  three_items_sum_usd: number;
  three_items_share_pct: number | null;
  other_semicon_usd: number | null;
};

export type BokEpiRecord = {
  dram_krw_idx: number | null;
  dram_krw_yoy: number | null;
  dram_usd_idx: number | null;
  dram_usd_yoy: number | null;
  flash_krw_idx: number | null;
  flash_krw_yoy: number | null;
  flash_usd_idx: number | null;
  flash_usd_yoy: number | null;
};

export type MonthlyCombinedRecord = {
  ym: string;
  total_semicon: TotalSemiconRecord;
  DRAM: ChipItemRecord;
  FLASH: ChipItemRecord;
  MCP: ChipItemRecord;
  bok_epi: BokEpiRecord;
};

export type CycleWindowStats = {
  window: string;
  start_trough_ym: string;
  start_trough_usd_per_U: number;
  peak_price_ym: string;
  peak_usd_per_U: number;
  upturn_duration_months: number;
  upturn_gain_pct: number;
  post_peak_trough_ym: string;
  post_peak_trough_usd_per_U: number;
  post_peak_drawdown_pct: number;
  downturn_duration_months: number;
  recovery_ym: string | null;
  recovery_months_from_peak: number | null;
  peak_units_ym: string;
  peak_units_U: number;
  price_to_units_peak_lag_months: number;
  peak_export_usd_ym: string;
  peak_export_usd: number;
};

export type ChipCyclePayload = {
  meta: {
    project: string;
    collected_at: string;
    period: string;
    total_observations_3items: number;
    sources: Array<{
      name: string;
      codes: string[];
      units: string;
      url: string;
    }>;
  };
  validation: {
    total_3item_observations: number;
    months_per_item: number;
    first_month: string;
    last_month: string;
    missing_months: string[];
    duplicate_months: number;
    zero_quantity_months: number;
    negative_value_months: number;
    decumulation_annual_mismatch_count: number;
    dram_existing_vs_new_exact_match: boolean;
    shapley_max_reconciliation_error_usd: number;
  };
  cycles_analysis: Record<string, Record<ItemKey, CycleWindowStats>>;
  bok_macro_trade: {
    terms_of_trade_episodes: Array<{
      period: string;
      driver_type: string;
      main_cause: string;
      export_price_yoy: number;
      import_price_yoy: number;
      gdp_growth: number;
      gdi_growth: number;
      gdi_gdp_gap: number;
    }>;
    quarterly_gdp_gdi: Array<{
      quarter: string;
      real_gdp: number;
      real_gdi: number;
      gap_gdi_gdp: number;
      nominal_gdp: number;
    }>;
    bok_trade_indices_monthly: Array<{
      ym: string;
      exp_vol_idx: number;
      exp_vol_yoy: number;
      exp_val_idx: number;
      exp_val_yoy: number;
      net_tot_idx: number;
      net_tot_yoy: number;
      inc_tot_idx: number;
      inc_tot_yoy: number;
    }>;
    it_spillover_metrics: {
      it_share_in_manufacturing_pct: { past_avg: number; q1_2026: number };
      it_share_in_all_industry_pct: { past_avg: number; q1_2026: number };
      employment_inducement_coeff_2023: { all_industry: number; manufacturing: number; it_manufacturing: number };
      production_inducement_coeff_2023: { all_industry: number; manufacturing: number; it_manufacturing: number };
      it_employment_share_apr2026_pct: number;
      semicon_equipment_import_dependency_pct: number;
      other_mfg_equipment_import_dependency_pct: number;
      operating_profit_krw_trillion: Array<{ year: string; samsung_skh: number; others: number }>;
      capex_samsung_skh_krw_trillion: Array<{ year: string; capex: number }>;
      value_chain_market_share_2025: Array<{ segment: string; korea: number; us: number; taiwan: number; china: number }>;
    };
  };
  monthly: MonthlyCombinedRecord[];
};

export const metricMeta: Record<Metric, { label: string; color: string; short: string }> = {
  export_usd: { label: "수출금액", color: "#2f6df6", short: "금액" },
  export_units: { label: "신고수량", color: "#16a36a", short: "수량" },
  usd_per_unit: { label: "평균 단위가치", color: "#f08a24", short: "단가" },
};

export const itemMeta: Record<
  ItemKey,
  {
    key: ItemKey;
    hsk: string;
    name: string;
    shortName: string;
    color: string;
    lightBg: string;
    dashArray?: string;
    roleSummary: string;
    scopeNote: string;
  }
> = {
  DRAM: {
    key: "DRAM",
    hsk: "8542321010",
    name: "D램 (DRAM)",
    shortName: "D램",
    color: "#2f6df6",
    lightBg: "#eef4ff",
    roleSummary: "서버·PC·모바일 기기에서 연산 데이터를 실시간으로 읽고 쓰는 휘발성 주메모리 핵심 품목",
    scopeNote: "HSK 8542.32-1010(디램). 범용 DDR4·DDR5·LPDDR 등이 포함되며, HBM 완성품의 품목분류 포함 여부는 신고 형태에 따라 달라질 수 있음.",
  },
  FLASH: {
    key: "FLASH",
    hsk: "8542321030",
    name: "플래시 메모리",
    shortName: "플래시",
    color: "#16a36a",
    lightBg: "#ecfdf5",
    dashArray: "6 3",
    roleSummary: "전원이 꺼져도 데이터를 보존하는 비휘발성 메모리로, AI 데이터센터용 고용량 eSSD·스마트폰 저장장치의 핵심",
    scopeNote: "HSK 8542.32-1030(플래시메모리). 낸드플래시(NAND) 단품과 NOR 플래시 등이 함께 포괄되며, 완제품 SSD(HSK 8471.70)와는 별도 집계됨.",
  },
  MCP: {
    key: "MCP",
    hsk: "8542323000",
    name: "복합구조칩 집적회로 (MCP)",
    shortName: "복합구조칩",
    color: "#8b5cf6",
    lightBg: "#f5f3ff",
    dashArray: "2 2",
    roleSummary: "두 개 이상의 집적회로 다이(Die)나 메모리 구조를 단일 패키지로 적층·결합한 고집적 메모리·복합 반도체",
    scopeNote: "HSK 8542.32-3000(복합구조칩 집적회로, 기억소자). 모바일용 MCP(NAND+DRAM 결합) 및 고적층 패키징 메모리가 포함될 수 있으나, HBM 전용 통계가 아니므로 HBM 수출액과 동일시할 수 없음.",
  },
};

export function pct(current: number, previous: number) {
  return previous === 0 ? null : (current / previous - 1) * 100;
}

export function movingAverage(records: DramRecord[], metric: Metric, window: number) {
  return records.map((record, index) => {
    if (window <= 1) return record[metric];
    const slice = records.slice(Math.max(0, index - window + 1), index + 1);
    return slice.reduce((sum, item) => sum + item[metric], 0) / slice.length;
  });
}

export function transform(records: DramRecord[], metric: Metric, mode: "level" | "yoy" | "index", window = 1) {
  const smooth = movingAverage(records, metric, window);
  if (mode === "index") {
    const base = smooth[0] || 1;
    return smooth.map((value) => (value / base) * 100);
  }
  if (mode === "yoy") {
    return records.map((_, index) => (index < 12 ? null : pct(smooth[index], smooth[index - 12])));
  }
  return smooth;
}

export function shapley(a: DramRecord, b: DramRecord) {
  const p0 = a.usd_per_unit;
  const q0 = a.export_units;
  const p1 = b.usd_per_unit;
  const q1 = b.export_units;
  const delta = b.export_usd - a.export_usd;
  const price = ((p1 - p0) * (q0 + q1)) / 2;
  const quantity = ((q1 - q0) * (p0 + p1)) / 2;
  return {
    delta,
    price,
    quantity,
    priceShare: Math.abs(delta) < 1 ? null : (price / delta) * 100,
    quantityShare: Math.abs(delta) < 1 ? null : (quantity / delta) * 100,
  };
}

export function shapleyItem(a: ChipItemRecord, b: ChipItemRecord) {
  const p0 = a.usd_per_U;
  const q0 = a.export_units_U;
  const p1 = b.usd_per_U;
  const q1 = b.export_units_U;
  const delta = b.export_usd - a.export_usd;
  const price = ((p1 - p0) * (q0 + q1)) / 2;
  const quantity = ((q1 - q0) * (p0 + p1)) / 2;
  return {
    delta,
    price,
    quantity,
    priceShare: Math.abs(delta) < 1 ? null : (price / delta) * 100,
    quantityShare: Math.abs(delta) < 1 ? null : (quantity / delta) * 100,
    valuePct: pct(b.export_usd, a.export_usd),
    unitsPct: pct(b.export_units_U, a.export_units_U),
    pricePct: pct(b.usd_per_U, a.usd_per_U),
  };
}

export function pearson(pairs: Array<[number, number]>) {
  if (pairs.length < 3) return null;
  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / n;
  let numerator = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    numerator += (x - meanX) * (y - meanY);
    dx += (x - meanX) ** 2;
    dy += (y - meanY) ** 2;
  }
  return dx && dy ? numerator / Math.sqrt(dx * dy) : null;
}

export function lagCorrelation(records: DramRecord[], lag: number) {
  const price = records.map((r) => r.avg_value_yoy_pct);
  const units = records.map((r) => r.units_yoy_pct);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < records.length; i++) {
    const j = i + lag;
    if (j < 0 || j >= records.length) continue;
    if (price[i] == null || units[j] == null) continue;
    pairs.push([price[i]!, units[j]!]);
  }
  return { correlation: pearson(pairs), n: pairs.length, pairs };
}

export function lagCorrelationItem(monthly: MonthlyCombinedRecord[], item: ItemKey, lag: number) {
  const price = monthly.map((r) => r[item].unit_value_yoy_pct);
  const units = monthly.map((r) => r[item].units_yoy_pct);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < monthly.length; i++) {
    const j = i + lag;
    if (j < 0 || j >= monthly.length) continue;
    if (price[i] == null || units[j] == null) continue;
    pairs.push([price[i]!, units[j]!]);
  }
  return { correlation: pearson(pairs), n: pairs.length, pairs };
}

export function buildMultiItemSeries(
  monthly: MonthlyCombinedRecord[],
  metric: ItemMetric,
  mode: "level" | "yoy" | "index",
  windowSize: number
) {
  const items: ItemKey[] = ["DRAM", "FLASH", "MCP"];
  const smoothedByItem: Record<ItemKey, number[]> = { DRAM: [], FLASH: [], MCP: [] };

  for (const key of items) {
    const rawVals = monthly.map((m) => m[key][metric]);
    smoothedByItem[key] = rawVals.map((_, idx) => {
      if (windowSize <= 1) return rawVals[idx];
      const slice = rawVals.slice(Math.max(0, idx - windowSize + 1), idx + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
  }

  return monthly.map((row, idx) => {
    const point: Record<string, string | number | null> = { ym: row.ym };
    for (const key of items) {
      const arr = smoothedByItem[key];
      if (mode === "level") {
        point[key] = arr[idx];
      } else if (mode === "index") {
        const base = arr[0] || 1;
        point[key] = (arr[idx] / base) * 100;
      } else {
        // yoy
        if (windowSize <= 1) {
          if (metric === "export_usd") point[key] = row[key].value_yoy_pct;
          else if (metric === "export_units_U") point[key] = row[key].units_yoy_pct;
          else if (metric === "usd_per_U") point[key] = row[key].unit_value_yoy_pct;
          else point[key] = row[key].kg_value_yoy_pct;
        } else {
          point[key] = idx < 12 ? null : pct(arr[idx], arr[idx - 12]);
        }
      }
    }
    return point;
  });
}

export function downloadCsv(records: DramRecord[], filename: string) {
  const headers = Object.keys(records[0] ?? {});
  const lines = [headers.join(","), ...records.map((row) => headers.map((key) => String(row[key as keyof DramRecord] ?? "")).join(","))];
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadThreeItemsCsv(monthly: MonthlyCombinedRecord[], filename = "반도체_3품목_월별_수출입_가격수량_2007-2026.csv") {
  const headers = [
    "ym",
    "hsk",
    "category",
    "export_usd",
    "export_units_U",
    "export_weight_g",
    "usd_per_U",
    "usd_per_kg",
    "units_yoy_pct",
    "value_yoy_pct",
    "unit_value_yoy_pct",
    "import_usd",
    "import_units_U",
    "import_weight_g",
  ];
  const rows: string[] = [headers.join(",")];
  const items: ItemKey[] = ["DRAM", "FLASH", "MCP"];
  for (const m of monthly) {
    for (const key of items) {
      const r = m[key];
      rows.push(
        [
          r.ym,
          r.hsk,
          r.category,
          r.export_usd,
          r.export_units_U,
          r.export_weight_g,
          r.usd_per_U.toFixed(6),
          r.usd_per_kg.toFixed(3),
          r.units_yoy_pct == null ? "" : r.units_yoy_pct.toFixed(4),
          r.value_yoy_pct == null ? "" : r.value_yoy_pct.toFixed(4),
          r.unit_value_yoy_pct == null ? "" : r.unit_value_yoy_pct.toFixed(4),
          r.import_usd,
          r.import_units_U,
          r.import_weight_g,
        ].join(",")
      );
    }
  }
  const blob = new Blob(["\ufeff" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const compactUsd = (value: number) => `${(value / 1e8).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억 달러`;
export const compactUnits = (value: number) => `${(value / 1e8).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억 개(U)`;
export const formatPct = (value: number | null | undefined, digits = 1) =>
  value == null || Number.isNaN(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
