// src/loadStaticData.js
import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * This loader ONLY handles tabular sources (CSV/XLSX).
 *
 * HOW IT WORKS
 * ------------
 * - CSV files: imported with ?raw (string) → parsed with Papa → capped rows → labeled.
 * - XLSX files: imported with ?url (asset URL) → fetch ArrayBuffer → parse with xlsx → 
 *   iterate ALL sheets → cap rows per sheet → labeled per sheet.
 *
 * Add new files by following the "ADD MORE FILES" section at the bottom.
 */

// ---------- IMPORT YOUR TABULAR FILES HERE ----------
import dssCsvRaw from "./Data/dss-demographics-2021-sa2-june-2025.csv?raw"; // CSV as raw text
import absUrl from "./Data/ABS_Retirement_Comparison.xlsx?url";            // Excel as URL
import trpUrl from "./Data/Transition_Retirement_Plans.xlsx?url";          // Excel as URL
// ---------------------------------------------------

const ROW_CAP = 30; // cap per dataset or sheet to keep prompts responsive

// ---- Simple in-module cache so we only parse once per page load ----
let _cachedBlock = null;
let _buildOncePromise = null;

/** Parse a CSV raw string into array-of-objects and cap rows. */
function parseCsvRawCapped(raw) {
  if (!raw) return [];
  const res = Papa.parse(raw, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.slice(0, ROW_CAP);
}

/** Fetch an .xlsx URL, parse ALL sheets to { sheetName: rows[] } with caps. */
async function parseXlsxAllSheetsCapped(url) {
  if (!url) return {};
  const buf = await fetch(url).then((r) => r.arrayBuffer());
  const wb = XLSX.read(buf, { type: "array" });

  const out = {};
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    out[sheetName] = rows.slice(0, ROW_CAP);
  }
  return out; // e.g., { "Sheet1": [...], "Sheet2": [...] }
}

/**
 * buildTabularReferenceBlock
 * --------------------------
 * Returns a single string that contains labeled snippets from:
 * - CSV sources
 * - ALL sheets of each XLSX source
 *
 * The string is meant to be appended to your static “Reference Information” block.
 * It is cached so you don’t re-parse files every time the user asks a question.
 */
export async function buildTabularReferenceBlock() {
  if (_cachedBlock) return _cachedBlock;
  if (_buildOncePromise) return _buildOncePromise;

  _buildOncePromise = (async () => {
    const parts = [];

    // 1) CSV(s)
    const dssRows = parseCsvRawCapped(dssCsvRaw);
    if (dssRows.length) {
      parts.push(
        `--- DSS_Demographics.csv (first ${ROW_CAP} rows) ---\n` +
          dssRows.map((r) => JSON.stringify(r)).join("\n")
      );
    }

    // 2) XLSX: parse ALL sheets per workbook and label by sheet name
    const [absSheets, trpSheets] = await Promise.all([
      parseXlsxAllSheetsCapped(absUrl),
      parseXlsxAllSheetsCapped(trpUrl),
    ]);

    for (const [sheetName, rows] of Object.entries(absSheets)) {
      if (rows && rows.length) {
        parts.push(
          `--- ABS_Retirement_Comparison.xlsx / ${sheetName} (first ${ROW_CAP} rows) ---\n` +
            JSON.stringify(rows)
        );
      }
    }

    for (const [sheetName, rows] of Object.entries(trpSheets)) {
      if (rows && rows.length) {
        parts.push(
          `--- Transition_Retirement_Plans.xlsx / ${sheetName} (first ${ROW_CAP} rows) ---\n` +
            JSON.stringify(rows)
        );
      }
    }

    _cachedBlock = parts.join("\n\n");
    return _cachedBlock;
  })();

  return _buildOncePromise;
}

/**
 * ADD MORE FILES (optional)
 * -------------------------
 * CSV:
 *   import myCsvRaw from "./Data/MyFile.csv?raw";
 *   const myCsvRows = parseCsvRawCapped(myCsvRaw);
 *   parts.push(
 *     `--- MyFile.csv (first ${ROW_CAP} rows) ---\n` +
 *     myCsvRows.map(r => JSON.stringify(r)).join("\n")
 *   );
 *
 * XLSX:
 *   import myXlsxUrl from "./Data/MyWorkbook.xlsx?url";
 *   const mySheets = await parseXlsxAllSheetsCapped(myXlsxUrl);
 *   for (const [sheet, rows] of Object.entries(mySheets)) {
 *     if (rows.length) {
 *       parts.push(
 *         `--- MyWorkbook.xlsx / ${sheet} (first ${ROW_CAP} rows) ---\n` +
 *         JSON.stringify(rows)
 *       );
 *     }
 *   }
 */
