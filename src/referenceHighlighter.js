// src/referenceHighlighter.js
//
// wrap up-to-3-word matching substrings with <a> links to the
// correct source URLs. Hover tooltips use the anchor's title attribute.
// We only link text that clearly appears in BOTH (response & source).
//


import { SOURCE_URLS } from "./referenceMap";

// Parse the "--- Section ---" blocks from buildReferenceText/selectRelevant output
// and associate each block with canonical source names that map to URLs.
function parseSections(staticRef) {
  // Returns: [{ label, text, url }]
  const sections = [];
  if (!staticRef) return sections;

  // Split on headers like: --- ATO.txt ---, --- DSS Demographics (...) ---, etc.
  const regex = /---\s*([^-]+?)\s*---\s*\n([\s\S]*?)(?=(?:\n---\s)|\s*$)/g;
  let match;
  while ((match = regex.exec(staticRef)) !== null) {
    const rawLabel = match[1].trim();
    const body = match[2] || "";

    // Map label to a canonical key used in SOURCE_URLS
    // We'll try a few straightforward normalizations:
    let key = rawLabel;

    // Common variants we know from your builder:
    // - "ATO.txt"
    // - "SuperConsumersAustralia.txt"
    // - "DSS Demographics ..."
    // - "Leaving_The_Workforce.json"
    // - "ABS_Retirement_Comparison.xlsx ..."
    // - "Transition_Retirement_Plans.xlsx ..."
    if (/^ato\.txt/i.test(key)) key = "ATO.txt";
    else if (/^superconsumersaustralia\.txt/i.test(key)) key = "SuperConsumersAustralia.txt";
    else if (/^dss demographics/i.test(key)) key = "DSS Demographics";
    else if (/^leaving_the_workforce\.json/i.test(key)) key = "Leaving_The_Workforce.json";
    else if (/^abs_retirement_comparison\.xlsx/i.test(key)) key = "ABS_Retirement_Comparison.xlsx";
    else if (/^transition_retirement_plans\.xlsx/i.test(key)) key = "Transition_Retirement_Plans.xlsx";

    const url = SOURCE_URLS[key];
    if (url) {
      sections.push({ label: rawLabel, key, text: body, url });
    }
  }
  return sections;
}

// Utility: escape regex special chars
function escRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Make a simple list of candidate n-grams (1–3 words) from source text.
function extractCandidatePhrasesFromSource(sourceText) {
  // Keep it pragmatic: extract tokens (words/numbers), slide windows of length 3→2→1
  const tokens = (sourceText || "")
    .replace(/[^\p{L}\p{N}\s%$€£\-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const grams = new Set();

  const maxGram = 3;
  for (let n = maxGram; n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const gram = tokens.slice(i, i + n).join(" ").trim();
      // Quick filters to avoid junk:
      // - too short (1 char)
      // - common stopword-only grams (crude)
      if (gram.length < 2) continue;
      grams.add(gram);
    }
  }
  return Array.from(grams);
}

// Find overlaps between response and a source block; return spans with URL.
function findMatches(response, section) {
  const matches = [];
  if (!response || !section?.text || !section?.url) return matches;

  const lowerResp = response.toLowerCase();
  const candidates = extractCandidatePhrasesFromSource(section.text);

  // Prefer longer n-grams first (3 words → 2 → 1)
  candidates.sort((a, b) => b.split(" ").length - a.split(" ").length);

  const alreadyCovered = []; // store {start, end} indices in response to avoid overlaps

  function isOverlapping(start, end) {
    return alreadyCovered.some(r => !(end <= r.start || start >= r.end));
  }

  for (const gram of candidates) {
    const words = gram.split(" ");
    if (words.length > 3) continue; // hard cap
    const pattern = new RegExp(`\\b${escRegex(gram)}\\b`, "i"); // word-boundary match
    const m = pattern.exec(response);
    if (!m) continue;

    const start = m.index;
    const end = start + m[0].length;

    if (isOverlapping(start, end)) continue;

    // Keep only sensible grams (avoid pure stopwords: crude list)
    const stop = new Set(["the","and","or","to","of","in","on","for","a","an","by","with","as","is","are","be","was","were"]);
    const nonStopCount = words.filter(w => !stop.has(w.toLowerCase())).length;
    if (nonStopCount === 0) continue;

    // Record
    matches.push({ start, end, url: section.url, text: response.slice(start, end) });
    alreadyCovered.push({ start, end });
  }

  // sort by start
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

// Build HTML with anchor tags; also escape unlinked regions safely.
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function highlightResponseWithSources(responseText, staticRefText) {
  const sections = parseSections(staticRefText);
  if (!responseText || !sections.length) {
    return escapeHtml(responseText || "");
  }

  // 1) Collect candidate matches per section (source)
  let perSectionBest = [];
  for (const section of sections) {
    const matches = findMatches(responseText, section);
    if (!matches.length) continue;

    // Choose ONE best match for this source:
    // prefer longer text, then earlier position
    matches.sort((a, b) => {
      if (b.text.length !== a.text.length) return b.text.length - a.text.length;
      return a.start - b.start;
    });
    const best = matches[0];
    perSectionBest.push({
      ...best,
      url: section.url, // ensure URL from section
    });
  }

  // 2) Enforce "one link per source URL" across the whole message
  const byUrl = new Map();
  for (const m of perSectionBest) {
    const prev = byUrl.get(m.url);
    if (!prev) {
      byUrl.set(m.url, m);
    } else {
      // Keep the better one (longer, then earlier)
      if (
        m.text.length > prev.text.length ||
        (m.text.length === prev.text.length && m.start < prev.start)
      ) {
        byUrl.set(m.url, m);
      }
    }
  }

  // 3) Resolve overlaps globally (keep earlier/longer ones)
  const uniqueMatches = Array.from(byUrl.values()).sort((a, b) => {
    if (a.start === b.start) return b.text.length - a.text.length;
    return a.start - b.start;
  });

  const final = [];
  let cursor = 0;
  let lastEnd = -1;

  for (const m of uniqueMatches) {
    // Skip if overlapping an already-accepted span
    if (m.start < lastEnd) continue;

    if (cursor < m.start) {
      final.push(escapeHtml(responseText.slice(cursor, m.start)));
    }

    const safeText = escapeHtml(m.text);
    const safeUrl = escapeHtml(m.url);
    final.push(
      `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${safeUrl}">${safeText}</a>`
    );

    cursor = m.end;
    lastEnd = m.end;
  }

  if (cursor < responseText.length) {
    final.push(escapeHtml(responseText.slice(cursor)));
  }

  return final.join("");
}

