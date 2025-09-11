// src/referenceHighlighter.js
//
// Sentence-level attribution + strict linkable phrase rules
// + block-level formatter (paragraphs & bullet lists)

import { SOURCE_URLS } from "./referenceMap";

// ---------- Config ----------
const STOPWORDS = new Set([
  "the","and","or","to","of","in","on","for","a","an","by","with","as","is","are","be","was","were",
  "this","that","these","those","here","there","it","its","at","from","into","over","under","about",
  "your","you","we","our","us","they","their"
]);

const DENYLIST_SINGLE_WORD = new Set([
  "there","here","this","that","it","they","their","our","your","and","the","or"
]);

const SECTION_SCORE_THRESHOLD = 2;

// ---------- Helpers ----------
function parseSections(staticRef) {
  const sections = [];
  if (!staticRef) return sections;

  const regex = /---\s*([^-]+?)\s*---\s*\n([\s\S]*?)(?=(?:\n---\s)|\s*$)/g;
  let match;
  while ((match = regex.exec(staticRef)) !== null) {
    const rawLabel = match[1].trim();
    const body = match[2] || "";

    // ==== ORDER-INDEPENDENT CANONICAL MAPPING ====
    const CANONICAL = [
      { re: /(^|\b)ato\.txt(\b|$)/i, key: "ATO.txt" },
      { re: /(^|\b)superconsumersaustralia\.txt(\b|$)/i, key: "SuperConsumersAustralia.txt" },
      { re: /(^|\b)leaving_the_workforce\.json(\b|$)/i, key: "Leaving_The_Workforce.json" },
      { re: /(^|\b)abs_retirement_comparison\.xlsx(\b|$)/i, key: "ABS_Retirement_Comparison.xlsx" },
      { re: /(^|\b)transition_retirement_plans\.xlsx(\b|$)/i, key: "Transition_Retirement_Plans.xlsx" },

      // DSS variants → map to the exact SOURCE_URLS key you use
      { re: /\bdss\s*demographics\b/i, key: "dss-demographics-2021-sa2-june-2025.csv" },
      { re: /(^|\b)dss[-_\s]?demographics[-_\s]?2021[-_\s]?sa2[-_\s]?june[-_\s]?2025\.csv(\b|$)/i,
        key: "dss-demographics-2021-sa2-june-2025.csv" },
    ];

    let key = rawLabel;

    // Pick the most specific (longest) match, no order bias
    let best = null, bestLen = -1;
    for (const c of CANONICAL) {
      const m = rawLabel.match(c.re);
      if (m && m[0].length > bestLen) {
        best = c;
        bestLen = m[0].length;
      }
    }
    if (best) key = best.key;

    // Fallback: fuzzy match against SOURCE_URLS keys if still unmapped
    if (!SOURCE_URLS[key]) {
      const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const nLabel = norm(rawLabel);
      const fallback = Object.keys(SOURCE_URLS).find(k => nLabel.includes(norm(k)));
      if (fallback) key = fallback;
    }
    // ==== END MAPPING ====

    const url = SOURCE_URLS[key];
    if (url) {
      sections.push({
        label: rawLabel,
        key,
        url,
        text: body,
        textLower: body.toLowerCase(),
      });
    }
  }
  return sections;
}

function escRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitSentencesWithIndex(text) {
  const out = [];
  const re = /[^.!?]+[.!?]?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const seg = m[0];
    const start = m.index;
    const end = start + seg.length;
    if (seg.trim().length) out.push({ text: seg, start, end });
  }
  return out;
}

function tokenize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s%$€£\-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hasDigitOrPercent(s) {
  return /[\d%]/.test(s);
}

function isLinkableGram(gram) {
  const words = gram.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  if (gram.length < 3 && !hasDigitOrPercent(gram)) return false;
  if (words.length === 1 && DENYLIST_SINGLE_WORD.has(words[0].toLowerCase())) return false;
  if (hasDigitOrPercent(gram)) return true;
  return words.some(w => !STOPWORDS.has(w.toLowerCase()));
}

function extractCandidatePhrasesFromSource(sourceText) {
  const tokens = (sourceText || "")
    .replace(/[^\p{L}\p{N}\s%$€£\-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const grams = new Set();
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const gram = tokens.slice(i, i + n).join(" ").trim();
      if (!isLinkableGram(gram)) continue;
      grams.add(gram);
    }
  }
  return Array.from(grams);
}

function scoreSectionForSentence(sentence, sectionLower) {
  const sentTokens = tokenize(sentence);
  let score = 0;
  for (const t of sentTokens) {
    if (STOPWORDS.has(t)) continue;
    if (!t) continue;
    const pattern = new RegExp(`\\b${escRegex(t)}\\b`, "i");
    if (!pattern.test(sectionLower)) continue;
    if (/\d/.test(t)) score += 3;
    else if (t.length >= 6) score += 2;
    else score += 1;
  }
  return score;
}

function findMatchesInSentence(sentenceText, sentenceOffset, section) {
  const matches = [];
  const candidates = extractCandidatePhrasesFromSource(section.text);
  candidates.sort((a, b) => b.split(" ").length - a.split(" ").length);

  const alreadyCovered = [];
  const isOverlapping = (s, e) => alreadyCovered.some(r => !(e <= r.start || s >= r.end));

  for (const gram of candidates) {
    const pattern = new RegExp(`\\b${escRegex(gram)}\\b`, "i");
    const m = pattern.exec(sentenceText);
    if (!m) continue;

    const start = sentenceOffset + m.index;
    const end = start + m[0].length;
    if (isOverlapping(start, end)) continue;

    matches.push({ start, end, url: section.url, text: m[0] });
    alreadyCovered.push({ start, end });
  }
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- NEW: block-level formatter (paragraphs + real bullets) ---
function blockifyWithBullets(htmlSafeText) {
  // Input is safe text where only our <a> tags may exist.
  const lines = htmlSafeText.replace(/\r\n/g, "\n").split("\n");

  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Match a bullet line: starts with optional spaces then one of *, -, or • followed by space
    const bulletMatch = line.match(/^\s*([*\-•])\s+(.*)$/);

    if (bulletMatch) {
      // Start a list; collect consecutive bullet lines
      out.push('<ul class="terah-list">');
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([*\-•])\s+(.*)$/);
        if (!m) break;
        const item = m[2].trim(); // may contain <a>…</a>
        out.push(`<li>${item}</li>`);
        i++;
      }
      out.push("</ul>");
      continue;
    }

    // Blank line -> paragraph spacer
    if (!line.trim()) {
      i++;
      continue;
    }

    // Regular paragraph: consume until blank line or bullet
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^\s*([*\-•])\s+/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    const text = para.join(" ").trim();
    out.push(`<p>${text}</p>`);
  }

  return out.join("");
}

// --- MAIN EXPORT: highlight + blockify ---
export function highlightResponseWithSources(responseText, staticRefText) {
  const sections = parseSections(staticRefText);
  if (!responseText) return "";

  // Build linked (but still line-based) safe text
  if (!sections.length) {
    const safe = escapeHtml(responseText || "");
    return blockifyWithBullets(safe);
  }

  const sentences = splitSentencesWithIndex(responseText);
  const perSentenceMatches = [];
  for (const seg of sentences) {
    let best = null;
    let bestScore = -Infinity;
    for (const sec of sections) {
      const sc = scoreSectionForSentence(seg.text, sec.textLower);
      if (sc > bestScore) {
        best = sec;
        bestScore = sc;
      }
    }
    if (!best || bestScore < SECTION_SCORE_THRESHOLD) continue;
    const mm = findMatchesInSentence(seg.text, seg.start, best);
    perSentenceMatches.push(...mm);
  }

  if (!perSentenceMatches.length) {
    const safe = escapeHtml(responseText);
    return blockifyWithBullets(safe);
  }

  const byUrl = new Map();
  for (const m of perSentenceMatches) {
    const prev = byUrl.get(m.url);
    if (
      !prev ||
      m.text.length > prev.text.length ||
      (m.text.length === prev.text.length && m.start < prev.start)
    ) {
      byUrl.set(m.url, m);
    }
  }

  const uniqueMatches = Array.from(byUrl.values()).sort((a, b) => {
    if (a.start === b.start) return b.text.length - a.text.length;
    return a.start - b.start;
  });

  const final = [];
  let cursor = 0;
  let lastEnd = -1;

  for (const m of uniqueMatches) {
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

  // Convert plain lines (with any <a> tags) into proper blocks
  return blockifyWithBullets(final.join(""));
}
