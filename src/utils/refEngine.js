// src/utils/refEngine.js

export const SOURCE_RULES = [
  {
    id: "DSS",
    detect: /---\s*DSS_Demographics\.csv\b/i,
    url: "https://data.gov.au/data/dataset/dss-income-support-recipients-monthly-time-series",
    keywords: [
      /income support/i,
      /JobSeeker/i,
      /Age Pension (recipients)?/i,
      /Disability Support Pension|\bDSP\b/i,
      /Youth Allowance/i,
      /Parenting Payment/i,
      /\bSA2\b/i,
    ],
  },
  {
    id: "ABS",
    detect: /---\s*ABS_Retirement_Comparison\.xlsx\b/i,
    url: "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/retirement-and-retirement-intentions-australia",
    keywords: [
      /\bABS\b(?:[^a-z0-9]+retirement intentions)?/i,
      /average (age|retirement age)/i,
      /main (reason|source) (to )?retire/i,
      /retirement intentions/i,
    ],
  },
  {
    id: "TRP",
    detect: /---\s*Transition_Retirement_Plans\.xlsx\b/i,
    url: "https://www.ato.gov.au/api/public/content/0-74828496-dead-4b1a-8503-ffbe95d37398?1755658690387",
    keywords: [
      /transition to retirement|\bTTR\b|\bTRIS\b/i,
      /non-commutable/i,
      /preservation age/i,
      /income stream/i,
    ],
  },
//   {
//     id: "ATO",
//     detect: /---\s*(guide1|ATO)\.txt\b/i,
//     url: "https://moneysmart.gov.au/financial-advice/choosing-a-financial-adviser", //https://www.ato.gov.au/individuals-and-families/jobs-and-employment-types/working-as-an-employee/leaving-the-workforce",
//     keywords: [
//       /leaving the workforce/i,
//      // /early retirement scheme/i,
//      // /CGT retirement exemption/i,
//      // /employee share schemes/i,
//      // /payments leading into retirement/i,
//      // /after you retire/i,
//     ],
//   },
  {
    id: "SCA",
    detect: /---\s*SuperConsumersAustralia\.txt\b/i,
    url: "https://superconsumers.com.au/research/superannuation-death-benefit-delays-you-dont-get-paid-faster-if-you-pay-higher-fees/",
    keywords: [
      /death benefit delays?/i,
      /superannuation death benefit/i,
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function lastMatchSpan(text, regex) {
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  let m, last = null;
  while ((m = re.exec(text))) {
    last = { i: m.index, j: m.index + m[0].length, str: m[0] };
  }
  return last;
}

function expandToTwoOrThreeWords(text, i, j) {
  const before = text.slice(0, i);
  const mid = text.slice(i, j);
  const after = text.slice(j);
  const wordsMid = mid.trim().split(/\s+/);
  if (wordsMid.length >= 2 && wordsMid.length <= 4) return { i, j };

  const left = before.match(/(?:\S+\s+){0,2}$/)?.[0] ?? "";
  const right = after.match(/^(?:\s*\S+){0,2}/)?.[0] ?? "";
  const candidate = (left + mid + right).trim().split(/\s+/).slice(0, 3).join(" ");

  const neigh = (left + mid + right);
  const startInNeigh = neigh.toLowerCase().indexOf(candidate.toLowerCase());
  const globalStart = i - left.length + startInNeigh;
  return { i: globalStart, j: globalStart + candidate.length };
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────
export function detectUsedSourcesFromContext(contextBlock = "") {
  const used = [];
  for (const rule of SOURCE_RULES) {
    if (rule.detect.test(contextBlock)) used.push(rule.id);
  }
  return used;
}

export function applyInlineRefsToPlainText(plainText = "", usedSourceIds = [], maxRefs = 4) {
  if (!plainText || !usedSourceIds?.length) return escapeHtml(plainText);

  const repl = [];
  const safe = plainText;

  for (const id of usedSourceIds) {
    const rule = SOURCE_RULES.find(r => r.id === id);
    if (!rule) continue;

    let span = null;

    // Tier 1: keyword in the answer
    for (const kw of rule.keywords) {
      const m = lastMatchSpan(safe, kw);
      if (m) {
        span = expandToTwoOrThreeWords(safe, m.i, m.j);
        break;
      }
    }

    // Tier 2: dataset context was used but no keyword found → last word fallback
    if (!span) {
      const m = safe.match(/(\S+)\s*$/);
      if (m) {
        const start = m.index;
        const end = start + m[0].length;
        span = { i: start, j: end };
      }
    }

    if (span) {
      repl.push({ start: span.i, end: span.j, url: rule.url, label: id });
    }

    if (repl.length >= maxRefs) break;
  }

  if (!repl.length) return escapeHtml(plainText);

  // Prevent overlaps
  repl.sort((a, b) => a.start - b.start || b.end - a.end);
  const filtered = [];
  let lastEnd = -1;
  for (const r of repl) {
    if (r.start >= lastEnd) { filtered.push(r); lastEnd = r.end; }
  }

  // Inject anchors (HTML safe)
  let out = escapeHtml(plainText);
  filtered.sort((a, b) => b.start - a.start);
  for (const r of filtered) {
    const before = out.slice(0, r.start);
    const mid = out.slice(r.start, r.end);
    const after = out.slice(r.end);
    const a = `<a class="inline-ref" href="${r.url}" target="_blank" rel="noopener noreferrer" title="${r.url}" data-url="${r.url}" data-src="${r.label}">`;
    out = before + a + mid + "</a>" + after;
  }
  return out;
}

// Optional CSS:
// .inline-ref { text-decoration: underline; text-decoration-style: dotted; cursor: pointer; }
