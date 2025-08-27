// src/utils/citations.js

export const SCRAPED_LABEL_TO_URL = [
  { label: "Services Australia (Age Pension)", url: "https://www.servicesaustralia.gov.au/age-pension" },
  { label: "ATO (Superannuation – Withdrawing and using your super)", url: "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/withdrawing-and-using-your-super" },
  { label: "ATO (Tax on super income streams)", url: "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-income-stream-tax-tables" },
  { label: "MoneySmart (Retirement income sources)", url: "https://moneysmart.gov.au/retirement-income-sources" },
  { label: "MoneySmart (Tax and super)", url: "https://moneysmart.gov.au/how-super-works/tax-and-super" },
];

export const LABEL_TO_URL_RULES = [
  { match: /^DSS_Demographics\.csv(?:\s*\/\s*.*)?(?:\s*\(.*\))?$/i,
    url: "https://data.gov.au/data/dataset/dss-income-support-recipients-monthly-time-series" },
  { match: /^ABS_Retirement_Comparison\.xlsx\s*\/\s*.+?(?:\s*\(.*\))?$/i,
    url: "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/retirement-and-retirement-intentions-australia" },
  { match: /^Transition_Retirement_Plans\.xlsx\s*\/\s*.+?(?:\s*\(.*\))?$/i,
    url: "https://www.ato.gov.au/api/public/content/0-74828496-dead-4b1a-8503-ffbe95d37398?1755658690387" },
  { match: /^(guide1|ATO)\.txt(?:\s*\/\s*.*)?$/i,
    url: "https://www.ato.gov.au/individuals-and-families/jobs-and-employment-types/working-as-an-employee/leaving-the-workforce" },
  { match: /^SuperConsumersAustralia\.txt(?:\s*\/\s*.*)?$/i,
    url: "https://superconsumers.com.au/research/superannuation-death-benefit-delays-you-dont-get-paid-faster-if-you-pay-higher-fees/" },
];

// Canonicalise near-miss labels
export function canonicalizeLabel(label) {
  const s = String(label || "").trim();
  if (/moneysmart/i.test(s) && /tax/i.test(s)) return "MoneySmart (Tax and super)";
  if (/moneysmart/i.test(s) && /retirement income/i.test(s)) return "MoneySmart (Retirement income sources)";
  if (/ato/i.test(s) && /income stream/i.test(s)) return "ATO (Tax on super income streams)";
  if (/ato/i.test(s) && /withdrawing/i.test(s)) return "ATO (Superannuation – Withdrawing and using your super)";
  return s;
}

export function labelsToUrls(labels) {
  const urls = [];
  for (const raw of labels) {
    const label = canonicalizeLabel(raw);
    const found = SCRAPED_LABEL_TO_URL.find((s) => s.label === label);
    if (found?.url && !urls.includes(found.url)) urls.push(found.url);
  }
  for (const raw of labels) {
    const label = canonicalizeLabel(raw);
    for (const rule of LABEL_TO_URL_RULES) {
      if (rule.match.test(label)) {
        if (!urls.includes(rule.url)) urls.push(rule.url);
        break;
      }
    }
  }
  return urls;
}

export function extractCitesLabels(fullText) {
  const m = (fullText || "").match(/^\s*CITES:\s*(.*)$/im);
  if (!m) return [];
  return (m[1] || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function stripCitesLine(fullText) {
  return (fullText || "")
    .split(/\r?\n/)
    .filter((l) => !/^\s*CITES:/i.test(l))
    .join("\n")
    .trim();
}

// Keep anchors short & meaningful
const KEYWORDS = [
  { re: /\btax[- ]free component\b/i,   label: "ATO (Tax on super income streams)" },
  { re: /\btaxable component\b/i,       label: "ATO (Tax on super income streams)" },
  { re: /\b(taxed|untaxed)\s+(source|fund)\b/i, label: "ATO (Tax on super income streams)" },
  { re: /\bsuper(annuation)? income stream\b/i, label: "ATO (Tax on super income streams)" },
];

// dedupe & clamp labels to max (default 4)
export function clampLabelsUnique(labels, max = 4) {
  const seen = new Set();
  const out = [];
  for (const raw of labels || []) {
    const c = canonicalizeLabel(raw);
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
      if (out.length >= max) break;
    }
  }
  return out;
}

// Ndrop any [[cite: …]] tags whose labels are NOT in final CITES list
export function pruneCiteTagsNotInCites(text, allowedLabels) {
  if (!text) return "";
  const allowed = new Set((allowedLabels || []).map(canonicalizeLabel));
  // paired
  text = text.replace(
    /\[\[cite:\s*([^\]]+?)\s*\]\]([\s\S]*?)\[\[\/cite\]\]/gi,
    (_m, raw, inner) => (allowed.has(canonicalizeLabel(raw)) ? _m : inner)
  );
  // standalone
  text = text.replace(
    /\[\[cite:\s*([^\]]+?)\s*\]\]/gi,
    (_m, raw) => (allowed.has(canonicalizeLabel(raw)) ? _m : "")
  );
  return text;
}

// // pick a sensible fallback label if the model forgot to cite but clearly used a domain topic
// export function guessFallbackLabelFromText(text) {
//   const t = String(text || "");
//   if (/age\s+pension/i.test(t)) return "Services Australia (Age Pension)";
//   if (/(income stream|transition to retirement|TRIS|tax[- ]free component|taxable component|untaxed|taxed)/i.test(t))
//     return "ATO (Tax on super income streams)";
//   if (/\btax\b/i.test(t) && /\bsuper\b/i.test(t))
//     return "MoneySmart (Tax and super)";
//   return "MoneySmart (Retirement income sources)";
// }

// append a standalone cite at the end of the last non-empty line
export function insertStandaloneCiteAtEnd(text, label) {
  const lines = String(text || "").split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) {
      lines[i] = `${lines[i].trim()} [[cite: ${canonicalizeLabel(label)}]]`;
      break;
    }
  }
  return lines.join("\n");
}

// Wrap first 1–3 words or a matched keyword span with an <a> link
function wrapSmallSpan(text, href, label) {
  if (!text || !href) return text;
  for (const { re, label: lbl } of KEYWORDS) {
    const m = text.match(re);
    if (m) {
      const i = m.index, j = i + m[0].length;
      const url = labelsToUrls([lbl])[0] || href;
      return text.slice(0, i)
        + `<a class="inline-cite" href="${url}" target="_blank" rel="noopener noreferrer" data-url="${url}" data-label="${lbl}">`
        + text.slice(i, j) + `</a>` + text.slice(j);
    }
  }
  const w = text.match(/^(\S+(?:\s+\S+){0,2})/); // 1–3 words
  if (!w) return text;
  const j = w[0].length;
  return `<a class="inline-cite" href="${href}" target="_blank" rel="noopener noreferrer" data-url="${href}" data-label="${label}">`
       + text.slice(0, j) + `</a>` + text.slice(j);
}

// [[cite: LABEL]]…[[/cite]] → anchor only 2–3 words
export function pairedCitesToHtmlLimited(text) {
  if (!text) return "";
  return text.replace(
    /\[\[cite:\s*([^\]]+?)\s*\]\]([\s\S]*?)\[\[\/cite\]\]/gi,
    (_m, rawLabel, inner) => {
      const label = canonicalizeLabel(rawLabel);
      const [url] = labelsToUrls([label]);
      if (!url) return inner;
      return wrapSmallSpan(inner, url, label);
    }
  );
}

// Standalone [[cite: LABEL]] → wrap 2–3 words before tag (or last keyword/number)
export function wrapStandaloneCitesTwoOrThree(html) {
  if (!html) return "";
  const citeRe = /\[\[cite:\s*([^\]]+?)\s*\]\]/i;
  const lines = html.split(/\r?\n/);
  const out = [];

  for (let line of lines) {
    let m;
    while ((m = line.match(citeRe))) {
      const i = m.index, j = i + m[0].length;
      const label = canonicalizeLabel(m[1]);
      const [href] = labelsToUrls([label]) || [];
      const before = line.slice(0, i);
      const after  = line.slice(j);
      if (!href) { line = before + after; continue; }

      // last keyword span in `before`
      let replaced = false;
      for (const { re, label: lbl } of KEYWORDS) {
        const all = [...before.matchAll(new RegExp(re.source, re.flags + (re.flags.includes("g") ? "" : "g"))) ];
        if (all.length) {
          const last = all[all.length - 1];
          const si = last.index, sj = si + last[0].length;
          const url = labelsToUrls([lbl])[0] || href;
          line = before.slice(0, si)
            + `<a class="inline-cite" href="${url}" target="_blank" rel="noopener noreferrer" data-url="${url}" data-label="${lbl}">`
            + before.slice(si, sj) + `</a>` + before.slice(sj) + after;
          replaced = true; break;
        }
      }
      if (replaced) continue;

      // last number
      const num = before.match(/(\$?\d[\d,]*(?:\.\d+)?%?)\s*$/);
      if (num) {
        const si = num.index, sj = si + num[1].length;
        line = before.slice(0, si)
          + `<a class="inline-cite" href="${href}" target="_blank" rel="noopener noreferrer" data-url="${href}" data-label="${label}">`
          + before.slice(si, sj) + `</a>` + before.slice(sj) + after;
        continue;
      }

      // last 1–3 words
      const w = before.match(/(\S+(?:\s+\S+){0,2})\s*$/);
      if (w) {
        const si = w.index, sj = si + w[1].length;
        line = before.slice(0, si)
          + `<a class="inline-cite" href="${href}" target="_blank" rel="noopener noreferrer" data-url="${href}" data-label="${label}">`
          + before.slice(si, sj) + `</a>` + before.slice(sj) + after;
      } else {
        line = before + after; // nothing to wrap — drop tag
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

// Keep this exported for compatibility, not use anymore.
export function addFallbackLinks(html) { return html || ""; }

// export function addFallbackLinks(html, urls) {
//   if (!html) return "";
//   const prefer = [
//     "ATO (Tax on super income streams)",
//     "ATO (Superannuation – Withdrawing and using your super)",
//     "MoneySmart (Tax and super)",
//   ];
//   let primary = null;
//   for (const lab of prefer) {
//     const [u] = labelsToUrls([lab]); if (u && urls.includes(u)) { primary = u; break; }
//   }
//   primary ||= urls[0] || labelsToUrls(["ATO (Tax on super income streams)"])[0];

//   const lines = html.split(/\r?\n/);
//   const out = [];

//   for (let line of lines) {
//     if (/<a\s+[^>]*class=["']inline-cite["'][^>]*>/i.test(line)) { out.push(line); continue; }

//     // keyword
//     let done = false;
//     for (const { re, label } of KEYWORDS) {
//       const m = line.match(re);
//       if (m) {
//         const i = m.index, j = i + m[0].length;
//         const url = labelsToUrls([label])[0] || primary;
//         if (url) {
//           line = line.slice(0, i)
//             + `<a class="inline-cite" href="${url}" target="_blank" rel="noopener noreferrer" data-url="${url}" data-label="${label}">`
//             + line.slice(i, j) + `</a>` + line.slice(j);
//           done = true; break;
//         }
//       }
//     }
//     if (!done && primary) {
//       // number
//       const num = line.match(/(\$?\b\d[\d,]*(?:\.\d+)?%?\b)/);
//       if (num) {
//         const i = num.index, j = i + num[1].length;
//         line = line.slice(0, i)
//           + `<a class="inline-cite" href="${primary}" target="_blank" rel="noopener noreferrer" data-url="${primary}" data-label="Source">`
//           + line.slice(i, j) + `</a>` + line.slice(j);
//         done = true;
//       }
//     }
//     if (!done && primary) {
//       // first 1–3 words
//       const w = line.match(/^(\S+(?:\s+\S+){0,2})/);
//       if (w) {
//         const j = w[0].length;
//         line = `<a class="inline-cite" href="${primary}" target="_blank" rel="noopener noreferrer" data-url="${primary}" data-label="Source">`
//           + line.slice(0, j) + `</a>` + line.slice(j);
//       }
//     }
//     out.push(line);
//   }
//   return out.join("\n");
// }

