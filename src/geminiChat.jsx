// geminiChat1.jsx (merged)
// — Keeps your reference/citation pipeline
// — Adds optional proofread stage compatible with your teammate’s intent

import { GoogleGenAI } from "@google/genai";
import contextData from "./selenium-web-scraper/src/context.json";

// Your local text sources (kept)
import guide1 from "./Data/ATO.txt?raw";
import scaTxt from "./Data/SuperConsumersAustralia.txt?raw";

// Your table context builder (kept)
import { getTabularContextForQuery } from "./loadStaticData";

// Centralised citation helpers (kept)
import {
  SCRAPED_LABEL_TO_URL,
  canonicalizeLabel,
  labelsToUrls,
  extractCitesLabels,
  stripCitesLine,
  pairedCitesToHtmlLimited,
  wrapStandaloneCitesTwoOrThree,
  addFallbackLinks,
} from "./utils/citations";

// ──────────────────────────────────────────────────────────────────────────────
// Targeted text snippets (ATO/SCA) — your behaviour, tidied
// ──────────────────────────────────────────────────────────────────────────────
const TEXT_SNIPPET_MAX_PER_SOURCE = 6;
const TEXT_SNIPPET_MAX_CHARS_TOTAL = 8000;

function tokenize(q) {
  return (q || "").toLowerCase().match(/[a-z0-9%]+/g)?.filter(Boolean) ?? [];
}
function splitParas(txt) {
  return (txt || "").split(/\n\s*\n+/g).map(s => s.trim()).filter(Boolean);
}
function paraMatches(para, tokens) {
  if (!tokens.length) return true;
  const hay = para.toLowerCase();
  let hits = 0;
  for (const t of tokens) if (hay.includes(t)) hits++;
  return hits >= Math.min(2, tokens.length);
}
function pickParas(text, tokens, cap = TEXT_SNIPPET_MAX_PER_SOURCE) {
  const out = [];
  for (const p of splitParas(text)) {
    if (paraMatches(p, tokens)) {
      out.push(p);
      if (out.length >= cap) break;
    }
  }
  return out;
}
function buildTextSnippetsForQuery(queryText) {
  const tokens = tokenize(queryText);
  const sections = [];

  const ato = pickParas(guide1, tokens);
  if (ato.length) sections.push(`--- ATO.txt (snippets ${ato.length}) ---\n${ato.join("\n\n")}`);

  const sca = pickParas(scaTxt, tokens);
  if (sca.length) sections.push(`--- SuperConsumersAustralia.txt (snippets ${sca.length}) ---\n${sca.join("\n\n")}`);

  let text = sections.join("\n\n");
  if (text.length > TEXT_SNIPPET_MAX_CHARS_TOTAL) {
    text = text.slice(0, TEXT_SNIPPET_MAX_CHARS_TOTAL) + "\n\n--- [text snippets truncated] ---";
  }
  return text;
}

// Static TXT block intro (kept)
const txtDataIntro = `
--- guide1.txt ---
(See targeted ATO.txt snippets below.)

--- SuperConsumersAustralia.txt ---
(See targeted snippets below.)
`.trim();

// ──────────────────────────────────────────────────────────────────────────────
/** API client */
// Prefer env var; fallback left in for now (move to env for production)
const ai = new GoogleGenAI({
  apiKey: import.meta.env?.VITE_GEMINI_API_KEY || "AIzaSyBCM-WY7SxEACI95A3g34bGVVLEhJYmVJw",
});

// ──────────────────────────────────────────────────────────────────────────────
/** System instruction + citing rules (kept) */
const citationRules = `
CITATION RULES (STRICT):
- Prefer paired cites: [[cite: LABEL]]that short phrase[[/cite]]. Standalone [[cite: LABEL]] is allowed.
- Labels must match "Reference Information" headers or the “Scraped Sources Catalog”.
- Ensure every bullet/paragraph has at least one citation.
- After your answer output exactly one line: CITES: label | label
- Do NOT print raw URLs in the answer.
`.trim();

const baseSystemInstruction = `
You are a helpful retirement chatbot that answers questions about superannuation, age pension, and retirement planning in Australia. 
Only provide factual, general information from ATO, Services Australia, and MoneySmart. 
Never give personal financial advice or tailored recommendations. If asked, decline and refer to a licensed financial adviser.

Style:
- Be concise and specific. Use short bullets or sentences.
- No markdown emphasis or emojis.
- Every bullet/paragraph must include at least one citation.

${citationRules}

Scraped Sources Catalog (label :: url):
${SCRAPED_LABEL_TO_URL.map((s) => `- ${s.label} :: ${s.url}`).join("\n")}

Scraped Reference Context (read-only JSON):
${JSON.stringify(contextData, null, 2)}
`.trim();

// ──────────────────────────────────────────────────────────────────────────────
/** Optional proofread pass (mate’s idea), available on demand */
const proofreadInstruction = `
Proofread the following text.
1) If any details are incorrect, rewrite the text to ensure accuracy.
2) Ensure the text does not provide financial advice. If it does, rewrite it as factual, general information only.
3) If the text is accurate and not financial advice, reply ONLY with "ACCEPTABLE".
Return the final, proofread text or "ACCEPTABLE".
`.trim();

async function proofreadText(rawText) {
  try {
    const chat = await ai.chats.create({
      model: "gemini-2.0-flash",
      config: { systemInstruction: proofreadInstruction },
    });
    const res = await chat.sendMessage({ message: `Text to proofread:\n${rawText}`.trim() });
    const out = (res.text || "").trim();
    if (out.toUpperCase() === "ACCEPTABLE") return rawText;
    return out;
  } catch (e) {
    // On any proofread failure, fall back to the original
    console.warn("Proofread failed, returning original text:", e);
    return rawText;
  }
}

// Allow enabling proofread globally via env if desired
const USE_PROOFREADER_DEFAULT =
  String(import.meta.env?.VITE_USE_PROOFREADER || "").toLowerCase() === "true";

// ──────────────────────────────────────────────────────────────────────────────
/** 429 handling (kept) */
function parseRetryDelayMs(err) {
  try {
    const details = err?.error?.details || err?.details || [];
    const retryInfo = details.find((d) => d["@type"]?.includes("google.rpc.RetryInfo"));
    if (!retryInfo?.retryDelay) return null;
    const m = String(retryInfo.retryDelay).match(/^(\d+(?:\.\d+)?)s$/i);
    return m ? Math.ceil(parseFloat(m[1]) * 1000) : null;
  } catch { return null; }
}
async function withRateLimitRetry(fn, { retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      const code = err?.error?.code || err?.status || err?.code;
      const is429 = Number(code) === 429 || err?.message?.includes("Too Many Requests");
      if (!is429 || attempt === retries) throw lastErr;
      const delay = parseRetryDelayMs(err) ?? Math.min(2000 * (attempt + 1), 8000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ──────────────────────────────────────────────────────────────────────────────
/** Core call: build context → call Gemini → (optional) proofread */
// Returns plain TEXT (no HTML)
export async function sendToGemini(userInput, { proofread = USE_PROOFREADER_DEFAULT } = {}) {
  try {
    const textSnippets = buildTextSnippetsForQuery(userInput);
    const tabularRefs  = await getTabularContextForQuery(userInput);

    const systemInstruction =
      `${baseSystemInstruction}\n\nReference Information:\n${txtDataIntro}` +
      (textSnippets ? `\n\n${textSnippets}` : "") +
      (tabularRefs  ? `\n\n${tabularRefs}`  : "");

    const chat = await ai.chats.create({
      model: "gemini-2.0-flash",
      config: { systemInstruction },
    });

    const result = await withRateLimitRetry(
      () => chat.sendMessage({ message: userInput }),
      { retries: 2 }
    );

    const text = (result.text || "").trim();
    if (!proofread) return text;
    return await proofreadText(text);
  } catch (err) {
    console.error("sendToGemini error:", err);
    return "Sorry—something went wrong fetching an answer. Please try again in a moment.";
  }
}

// Returns HTML with compact inline citations (2–3 words with tooltip)
export async function sendToGeminiHtml(userInput, { proofread = USE_PROOFREADER_DEFAULT } = {}) {
  const full = await sendToGemini(userInput, { proofread });

  // 1) URLs from the CITES line
  const labels = extractCitesLabels(full).map(canonicalizeLabel);
  const urls = labelsToUrls(labels);

  // 2) Remove visible CITES line
  const visible = stripCitesLine(full);

  // 3) Turn cites into short anchors (2–3 words max)
  let html = pairedCitesToHtmlLimited(visible);       // paired cites → wrap small span
  html     = wrapStandaloneCitesTwoOrThree(html);     // standalone cites → wrap 2–3 words before tag
  html     = addFallbackLinks(html, urls);            // add one compact link where still missing

  return html;
}

// Convenience aliases compatible with teammate expectations
export async function sendToGeminiProofread(userInput) {
  return sendToGemini(userInput, { proofread: true });
}
export async function sendToGeminiHtmlProofread(userInput) {
  return sendToGeminiHtml(userInput, { proofread: true });
}
