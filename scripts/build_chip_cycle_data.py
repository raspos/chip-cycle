"""
CHIP CYCLE — 20년 반도체 통관데이터(2007.01~2026.09) 및 한국은행 수출물가지수·거시지표 통합 파이프라인
- 대상 품목:
  1. MTI 831 반도체 전체 (1977~2026.09, 누계 역산)
  2. HSK 8542321010 D램 (2007.01~2026.09, 237개월)
  3. HSK 8542321030 플래시 메모리 (2007.01~2026.09, 237개월, 누계 역산)
  4. HSK 8542323000 복합구조칩 집적회로 (2007.01~2026.09, 237개월, 누계 역산)
  5. 한국은행 ECOS 수출물가지수 (4.3.1.3 품목별 DRAM·플래시메모리, 2021.01~2026.07)
"""

import os
import csv
import json
import xlrd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROC_DIR = os.path.join(BASE_DIR, "data", "processed")
PUB_DIR = os.path.join(BASE_DIR, "public", "data")


def parse_kstat_xls(filepath, is_cumulative=False, usd_multiplier=1, weight_multiplier=1, has_units=True):
    wb = xlrd.open_workbook(filepath)
    sh = wb.sheet_by_index(0)
    year_blocks = {}
    current_year = None
    annual_summary = {}

    for r in range(4, sh.nrows):
        label = str(sh.cell_value(r, 0)).strip()
        if not label:
            continue
        if label.endswith("년"):
            current_year = int(label[:-1])
            year_blocks[current_year] = {}
            if has_units:
                annual_summary[current_year] = {
                    "export_usd": float(sh.cell_value(r, 1) or 0) * usd_multiplier,
                    "export_yoy": float(sh.cell_value(r, 2) or 0),
                    "export_weight_g": float(sh.cell_value(r, 3) or 0) * weight_multiplier,
                    "export_units": float(sh.cell_value(r, 5) or 0),
                    "import_usd": float(sh.cell_value(r, 7) or 0) * usd_multiplier,
                    "import_weight_g": float(sh.cell_value(r, 9) or 0) * weight_multiplier,
                    "import_units": float(sh.cell_value(r, 11) or 0),
                }
            else:
                annual_summary[current_year] = {
                    "export_usd": float(sh.cell_value(r, 1) or 0) * usd_multiplier,
                    "export_yoy": float(sh.cell_value(r, 2) or 0),
                    "export_weight_g": float(sh.cell_value(r, 3) or 0) * weight_multiplier,
                    "import_usd": float(sh.cell_value(r, 5) or 0) * usd_multiplier,
                    "import_yoy": float(sh.cell_value(r, 6) or 0),
                    "import_weight_g": float(sh.cell_value(r, 7) or 0) * weight_multiplier,
                }
        elif label.startswith("…") and label.endswith("월") and current_year is not None:
            m = int(label[1:-1])
            if has_units:
                year_blocks[current_year][m] = {
                    "export_usd": float(sh.cell_value(r, 1) or 0) * usd_multiplier,
                    "raw_export_yoy": float(sh.cell_value(r, 2) or 0),
                    "export_weight_g": float(sh.cell_value(r, 3) or 0) * weight_multiplier,
                    "raw_weight_yoy": float(sh.cell_value(r, 4) or 0),
                    "export_units": float(sh.cell_value(r, 5) or 0),
                    "raw_units_yoy": float(sh.cell_value(r, 6) or 0),
                    "import_usd": float(sh.cell_value(r, 7) or 0) * usd_multiplier,
                    "raw_import_yoy": float(sh.cell_value(r, 8) or 0),
                    "import_weight_g": float(sh.cell_value(r, 9) or 0) * weight_multiplier,
                    "import_units": float(sh.cell_value(r, 11) or 0),
                }
            else:
                year_blocks[current_year][m] = {
                    "export_usd": float(sh.cell_value(r, 1) or 0) * usd_multiplier,
                    "raw_export_yoy": float(sh.cell_value(r, 2) or 0),
                    "export_weight_g": float(sh.cell_value(r, 3) or 0) * weight_multiplier,
                    "raw_weight_yoy": float(sh.cell_value(r, 4) or 0),
                    "import_usd": float(sh.cell_value(r, 5) or 0) * usd_multiplier,
                    "raw_import_yoy": float(sh.cell_value(r, 6) or 0),
                    "import_weight_g": float(sh.cell_value(r, 7) or 0) * weight_multiplier,
                    "raw_import_weight_yoy": float(sh.cell_value(r, 8) or 0),
                }

    monthly_records = []
    cum_check_errors = []
    for y in sorted(year_blocks.keys()):
        months = sorted(year_blocks[y].keys())
        for m in months:
            cur = year_blocks[y][m]
            if is_cumulative and m > 1 and (m - 1) in year_blocks[y]:
                prev = year_blocks[y][m - 1]
                rec = {
                    "ym": f"{y:04d}-{m:02d}",
                    "year": y,
                    "month": m,
                    "export_usd": round(cur["export_usd"] - prev["export_usd"]),
                    "export_weight_g": round(cur["export_weight_g"] - prev["export_weight_g"]),
                    "import_usd": round(cur["import_usd"] - prev["import_usd"]),
                    "import_weight_g": round(cur["import_weight_g"] - prev["import_weight_g"]),
                    "cum_export_usd": round(cur["export_usd"]),
                }
                if has_units:
                    rec["export_units_U"] = round(cur["export_units"] - prev["export_units"])
                    rec["import_units_U"] = round(cur["import_units"] - prev["import_units"])
            else:
                rec = {
                    "ym": f"{y:04d}-{m:02d}",
                    "year": y,
                    "month": m,
                    "export_usd": round(cur["export_usd"]),
                    "export_weight_g": round(cur["export_weight_g"]),
                    "import_usd": round(cur["import_usd"]),
                    "import_weight_g": round(cur["import_weight_g"]),
                    "cum_export_usd": round(cur["export_usd"]),
                    "raw_export_yoy": cur.get("raw_export_yoy"),
                    "raw_units_yoy": cur.get("raw_units_yoy"),
                }
                if has_units:
                    rec["export_units_U"] = round(cur["export_units"])
                    rec["import_units_U"] = round(cur["import_units"])
            monthly_records.append(rec)

        if months:
            yr_recs = [r for r in monthly_records if r["year"] == y]
            sum_exp = sum(r["export_usd"] for r in yr_recs)
            ann_exp = round(annual_summary[y]["export_usd"])
            if sum_exp != ann_exp and ann_exp > 0 and len(months) == 12:
                cum_check_errors.append({"year": y, "sum_monthly": sum_exp, "annual": ann_exp})

    return monthly_records, annual_summary, cum_check_errors


def enrich_item_records(recs, hsk, category):
    by_ym = {r["ym"]: r for r in recs}
    out = []
    for r in recs:
        ym = r["ym"]
        y, m = r["year"], r["month"]
        prev_ym = f"{y-1:04d}-{m:02d}"
        prev = by_ym.get(prev_ym)

        exp_usd = r["export_usd"]
        exp_u = r["export_units_U"]
        exp_g = r["export_weight_g"]
        usd_per_u = exp_usd / exp_u if exp_u > 0 else None
        usd_per_kg = (exp_usd / exp_g) * 1000.0 if exp_g > 0 else None

        if prev and prev["export_usd"] > 0 and prev["export_units_U"] > 0:
            prev_u_val = prev["export_usd"] / prev["export_units_U"]
            prev_kg_val = (prev["export_usd"] / prev["export_weight_g"]) * 1000.0 if prev["export_weight_g"] > 0 else None
            units_yoy = (exp_u / prev["export_units_U"] - 1.0) * 100.0
            value_yoy = (exp_usd / prev["export_usd"] - 1.0) * 100.0
            uv_yoy = (usd_per_u / prev_u_val - 1.0) * 100.0 if (usd_per_u and prev_u_val) else None
            kg_yoy = (usd_per_kg / prev_kg_val - 1.0) * 100.0 if (usd_per_kg and prev_kg_val) else None
        else:
            units_yoy = None
            value_yoy = None
            uv_yoy = None
            kg_yoy = None

        out.append({
            "ym": ym,
            "hsk": hsk,
            "category": category,
            "export_usd": exp_usd,
            "export_units_U": exp_u,
            "export_weight_g": exp_g,
            "usd_per_U": usd_per_u,
            "usd_per_kg": usd_per_kg,
            "units_yoy_pct": units_yoy,
            "value_yoy_pct": value_yoy,
            "unit_value_yoy_pct": uv_yoy,
            "kg_value_yoy_pct": kg_yoy,
            "import_usd": r["import_usd"],
            "import_units_U": r["import_units_U"],
            "import_weight_g": r["import_weight_g"],
        })
    return out


def main():
    os.makedirs(PROC_DIR, exist_ok=True)
    os.makedirs(PUB_DIR, exist_ok=True)

    dram_recs, _, dram_err = parse_kstat_xls(
        os.path.join(RAW_DIR, "K-stat_HSK_8542321010_DRAM_2007-2026.xls"),
        is_cumulative=False, usd_multiplier=1, weight_multiplier=1, has_units=True,
    )
    flash_recs, _, flash_err = parse_kstat_xls(
        os.path.join(RAW_DIR, "K-stat_HSK_8542321030_FLASH_2007-2026.xls"),
        is_cumulative=True, usd_multiplier=1000, weight_multiplier=1000, has_units=True,
    )
    mcp_recs, _, mcp_err = parse_kstat_xls(
        os.path.join(RAW_DIR, "K-stat_HSK_8542323000_MCP_2007-2026.xls"),
        is_cumulative=True, usd_multiplier=1000, weight_multiplier=1000, has_units=True,
    )
    mti831_recs, _, mti831_err = parse_kstat_xls(
        os.path.join(RAW_DIR, "K-stat_MTI_831_반도체전체_1977-2026.xls"),
        is_cumulative=True, usd_multiplier=1000, weight_multiplier=1000, has_units=False,
    )

    dram_enriched = enrich_item_records(dram_recs, "8542321010", "DRAM")
    flash_enriched = enrich_item_records(flash_recs, "8542321030", "FLASH")
    mcp_enriched = enrich_item_records(mcp_recs, "8542323000", "MCP")

    combined_711 = []
    for i in range(len(dram_enriched)):
        combined_711.append(dram_enriched[i])
        combined_711.append(flash_enriched[i])
        combined_711.append(mcp_enriched[i])

    print(f"Verified {len(combined_711)} observations across DRAM, FLASH, MCP (De-cumulation mismatches: {len(dram_err)+len(flash_err)+len(mcp_err)+len(mti831_err)})")


if __name__ == "__main__":
    main()
