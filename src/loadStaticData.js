// loadStaticData.js
import Papa from "papaparse";
import * as XLSX from "xlsx";

import dssCsvRaw from "./Data/dss-demographics-2021-sa2-june-2025.csv?raw";
import absUrl from "./Data/ABS_Retirement_Comparison.csv?raw";
import trpUrl from "./Data/Transition_Retirement_Plans.xlsx?url";



const ROW_CAP = 50;           // keep things small for the model (might take too long to go through)
const CHAR_CAP_TEXT = 20000;  // per long text source

export async function loadStaticData() {
  // CSV → array of objects
  const demographicsCsv = Papa.parse(demographicsCsvRaw, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  return Array.isArray(data) ? data : [];
}

async function loadXlsxAllSheets(url) {
  const buf = await fetch(url).then((r) => r.arrayBuffer());
  const wb = XLSX.read(buf, { type: "array" });
  const out = {};
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    out[sheetName] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }
  return out;
}

function rowMatchesQuery(row, tokens) {
  if (!tokens.length) return true; // if no tokens, allow; we cap later
  const hay = JSON.stringify(row).toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

/**
 * Build trimmed, labeled, query-relevant context.
 * Returns a string safe to append to your system prompt.
 */
export async function getTabularContextForQuery(queryText) {
  const tokens = (queryText || "")
    .toLowerCase()
    .split(/[^a-z0-9%]+/gi)
    .filter(Boolean);

  // Warm caches
  if (!_csvCache) _csvCache = parseCsvRaw(dssCsvRaw);
  if (!_xlsxCache) {
    const [absSheets, trpSheets] = await Promise.all([
      loadXlsxAllSheets(absUrl),
      loadXlsxAllSheets(trpUrl),
    ]);
    _xlsxCache = { absSheets, trpSheets };
  }

  const parts = [];

  // DSS CSV
  if (_csvCache?.length) {
    const matches = [];
    for (const r of _csvCache) {
      if (rowMatchesQuery(r, tokens)) {
        matches.push(r);
        if (matches.length >= MAX_MATCHES_PER_SHEET) break;
      }
    }
    if (matches.length) {
      parts.push(
        `--- DSS_Demographics.csv (matches ${matches.length}) ---\n` +
        matches.map((r) => JSON.stringify(r)).join("\n")
      );
    }
  }

  // ABS workbook
  for (const [sheet, rows] of Object.entries(_xlsxCache.absSheets)) {
    let count = 0;
    const matches = [];
    for (const r of rows) {
      if (rowMatchesQuery(r, tokens)) {
        matches.push(r);
        if (++count >= MAX_MATCHES_PER_SHEET) break;
      }
    }
    if (matches.length) {
      parts.push(
        `--- ABS_Retirement_Comparison.xlsx / ${sheet} (matches ${matches.length}) ---\n` +
        JSON.stringify(matches)
      );
    }
  }

  // Transition workbook
  for (const [sheet, rows] of Object.entries(_xlsxCache.trpSheets)) {
    let count = 0;
    const matches = [];
    for (const r of rows) {
      if (rowMatchesQuery(r, tokens)) {
        matches.push(r);
        if (++count >= MAX_MATCHES_PER_SHEET) break;
      }
    }
    if (matches.length) {
      parts.push(
        `--- Transition_Retirement_Plans.xlsx / ${sheet} (matches ${matches.length}) ---\n` +
        JSON.stringify(matches)
      );
    }
  }

  // Hard character budget (protect the model call)
  let context = parts.join("\n\n");
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS) + "\n\n--- [context truncated] ---";
  }
  return context;
}
