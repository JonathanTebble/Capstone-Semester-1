// src/referenceHighlighter.js
//
// Sentence-level attribution + strict linkable phrase rules:
// - Pick ONE best source section per sentence.
// - Only link phrases from that section.
// - Only link meaningful n-grams (1–3 words) that contain a number/%
//   or at least one non-stopword (and not on a denylist).
// - Max one link per source across the whole message.

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

// Minimum score for a section to be considered the “best” for a sentence.
// Score is a weighted overlap of meaningful tokens.
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

    let key = rawLabel;
    if (/^ato\.txt/i.test(key)) key = "ATO.txt";
    else if (/^superconsumersaustralia\.txt/i.test(key)) key = "SuperConsumersAustralia.txt";
    else if (/^dss demographics/i.test(key)) key = "DSS Demographics";
    else if (/^leaving_the_workforce\.json/i.test(key)) key = "Leaving_The_Workforce.json";
    else if (/^abs_retirement_comparison\.xlsx/i.test(key)) key = "ABS_Retirement_Comparison.xlsx";
    else if (/^transition_retirement_plans\.xlsx/i.test(key)) key = "Transition_Retirement_Plans.xlsx";

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
  // Simple splitter that keeps indices.
  const out = [];
  const re = /[^.!?]+[.!?]?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const seg = m[0];
    const start = m.index;
    const end = start + seg.length;
    // ignore pure whitespace
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

  // Reject trivially short fragments unless they contain digits
  if (gram.length < 3 && !hasDigitOrPercent(gram)) return false;

  // Deny single-word fillers outright
  if (words.length === 1 && DENYLIST_SINGLE_WORD.has(words[0].toLowerCase())) {
    return false;
  }

  // At least one non-stopword OR it contains digits/percent
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

// Weighted overlap: numbers are most diagnostic; then capitalized/long tokens; else 1
function scoreSectionForSentence(sentence, sectionLower) {
  const sentTokens = tokenize(sentence);
  let score = 0;
  for (const t of sentTokens) {
    if (STOPWORDS.has(t)) continue;
    if (!t) continue;

    // require whole-word-ish presence in section (cheap check)
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

  // Prefer longer n-grams
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

  // sort by start
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

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

  const sentences = splitSentencesWithIndex(responseText);

  // 1) For each sentence, pick ONE best section by score
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

    // If best score is weak, skip linking for this sentence
    if (!best || bestScore < SECTION_SCORE_THRESHOLD) continue;

    // 2) Only look for matches from the best section for this sentence
    const mm = findMatchesInSentence(seg.text, seg.start, best);
    perSentenceMatches.push(...mm);
  }

  if (!perSentenceMatches.length) {
    return escapeHtml(responseText);
  }

  // 3) One link per source URL across the entire message (pick best: longer → earlier)
  const byUrl = new Map();
  for (const m of perSentenceMatches) {
    const prev = byUrl.get(m.url);
    if (!prev) {
      byUrl.set(m.url, m);
    } else {
      if (
        m.text.length > prev.text.length ||
        (m.text.length === prev.text.length && m.start < prev.start)
      ) {
        byUrl.set(m.url, m);
      }
    }
  }

  // 4) Resolve overlaps globally
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

  return final.join("");
}
