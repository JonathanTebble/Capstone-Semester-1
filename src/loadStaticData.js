// src/loadStaticData.js
import Papa from "papaparse";
import * as XLSX from "xlsx";

// --- TEXT (kept as-is; you already do this) ---
import atoTxt from "./Data/ATO.txt?raw";
import scaTxt from "./Data/SuperConsumersAustralia.txt?raw";

// --- CSV (import as raw text, then parse) ---
import demographicsCsvRaw from "./Data/dss-demographics-2021-sa2-june-2025.csv?raw";

// --- JSON (direct import) ---
import leavingWorkforce from "./Data/Leaving_The_Workforce.json";

// --- Excel (fetch as URL, read ArrayBuffer with xlsx) ---
import absUrl from "./Data/ABS_Retirement_Comparison.xlsx?url";
import trpUrl from "./Data/Transition_Retirement_Plans.xlsx?url";



const ROW_CAP = 500;           // keep things small for the model (might take too long to go through)
const CHAR_CAP_TEXT = 200000;  // per long text source

export async function loadStaticData() {
  // CSV → array of objects
  const demographicsCsv = Papa.parse(demographicsCsvRaw, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  }).data;

  // Excel → array of objects (first sheet)
  const [absBuf, trpBuf] = await Promise.all([
    fetch(absUrl).then(r => r.arrayBuffer()),
    fetch(trpUrl).then(r => r.arrayBuffer()),
  ]);

  const absWb = XLSX.read(absBuf, { type: "array" });
  const trpWb = XLSX.read(trpBuf, { type: "array" });

  const abs = XLSX.utils.sheet_to_json(absWb.Sheets[absWb.SheetNames[0]], { defval: "" });
  const trp = XLSX.utils.sheet_to_json(trpWb.Sheets[trpWb.SheetNames[0]], { defval: "" });

  return {
    texts: {
      ATO: atoTxt,
      SuperConsumersAustralia: scaTxt,
    },
    csv: {
      demographics: demographicsCsv,
    },
    excel: {
      ABS_Retirement_Comparison: abs,
      Transition_Retirement_Plans: trp,
    },
    json: {
      Leaving_The_Workforce: leavingWorkforce,
    },
  };
}

// Very simple compactor → sample rows and cap large text
export function buildReferenceText(data) {
  const parts = [];

  // txt (cap characters)
  parts.push(
    `--- ATO.txt ---\n${data.texts.ATO.slice(0, CHAR_CAP_TEXT)}`
  );
  parts.push(
    `--- SuperConsumersAustralia.txt ---\n${data.texts.SuperConsumersAustralia.slice(0, CHAR_CAP_TEXT)}`
  );

  // csv sample
  const demoRows = data.csv.demographics.slice(0, ROW_CAP);
  parts.push(
    `--- DSS Demographics (first ${ROW_CAP} rows) ---\n` +
      demoRows.map(r => JSON.stringify(r)).join("\n")
  );

  // json excerpt
  parts.push(
    `--- Leaving_The_Workforce.json (excerpt) ---\n` +
      JSON.stringify(data.json.Leaving_The_Workforce, null, 2).slice(0, CHAR_CAP_TEXT)
  );

  // excel samples
  parts.push(
    `--- ABS_Retirement_Comparison.xlsx (first ${ROW_CAP} rows) ---\n` +
      JSON.stringify(data.excel.ABS_Retirement_Comparison.slice(0, ROW_CAP))
  );
  parts.push(
    `--- Transition_Retirement_Plans.xlsx (first ${ROW_CAP} rows) ---\n` +
      JSON.stringify(data.excel.Transition_Retirement_Plans.slice(0, ROW_CAP))
  );

  return parts.join("\n\n");
}

// (Optional) tiny "retrieval": return only lines containing a keyword
export function selectRelevant(data, query) {
  const q = String(query || "").toLowerCase();
  if (!q) return buildReferenceText(data);

  const contains = (obj) => JSON.stringify(obj).toLowerCase().includes(q);

  const keepSome = (arr) => arr.filter(contains).slice(0, ROW_CAP);
  const keepText = (txt) => {
    if (!txt) return "";
    // return a short window around matches (simple)
    if (txt.toLowerCase().includes(q)) return txt.slice(0, CHAR_CAP_TEXT);
    return "";
  };

  const parts = [];
  const t1 = keepText(data.texts.ATO);
  if (t1) parts.push(`--- ATO.txt (relevant excerpt) ---\n${t1}`);
  const t2 = keepText(data.texts.SuperConsumersAustralia);
  if (t2) parts.push(`--- SuperConsumersAustralia.txt (relevant excerpt) ---\n${t2}`);

  const dem = keepSome(data.csv.demographics);
  if (dem.length)
    parts.push(`--- DSS Demographics (matching rows) ---\n` + dem.map(r => JSON.stringify(r)).join("\n"));

  const abs = keepSome(data.excel.ABS_Retirement_Comparison);
  if (abs.length)
    parts.push(`--- ABS_Retirement_Comparison.xlsx (matching rows) ---\n` + JSON.stringify(abs));

  const trp = keepSome(data.excel.Transition_Retirement_Plans);
  if (trp.length)
    parts.push(`--- Transition_Retirement_Plans.xlsx (matching rows) ---\n` + JSON.stringify(trp));

  const lw = contains(data.json.Leaving_The_Workforce) ? data.json.Leaving_The_Workforce : null;
  if (lw)
    parts.push(`--- Leaving_The_Workforce.json (matching) ---\n` + JSON.stringify(lw, null, 2).slice(0, CHAR_CAP_TEXT));

  // fall back to compact reference if nothing matched
  if (!parts.length) return buildReferenceText(data);
  return parts.join("\n\n");
}
