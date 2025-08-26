// geminiChat1.jsx
import { GoogleGenAI } from "@google/genai";
import contextData from "./selenium-web-scraper/src/context.json";
import guide1 from "./Data/ATO.txt?raw";
import scaTxt from "./Data/SuperConsumersAustralia.txt?raw";
import { getTabularContextForQuery } from "./loadStaticData";

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

// Targeted text snippets (ATO/SCA) — unchanged behaviour
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

// 
const txtDataIntro = `
--- guide1.txt ---
(See targeted ATO.txt snippets below.)

--- SuperConsumersAustralia.txt ---
(See targeted snippets below.)
`.trim();

const ai = new GoogleGenAI({
  apiKey: import.meta.env?.VITE_GEMINI_API_KEY || "AIzaSyBCM-WY7SxEACI95A3g34bGVVLEhJYmVJw",
});

// Citing instruction
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
You must only provide factual, general information based on publicly available government sources such as the ATO, Services Australia, and MoneySmart. 
You must never give personal financial advice, predictions, or recommendations tailored to an individual. 
If the user asks for personal advice, politely decline and refer them to a licensed financial adviser.

Always:
- Avoid personalising answers or making assumptions about the user's situation.
- Prioritise clarity, empathy, and actionable general guidance specific to Australian retirement laws.
- Respond in short, clear, and concise sentences.
- Do not italicise or bold text, and do not use emojis.

${citationRules}

Scraped Sources Catalog (label :: url):
${SCRAPED_LABEL_TO_URL.map((s) => `- ${s.label} :: ${s.url}`).join("\n")}

Scraped Reference Context (read-only JSON):
${JSON.stringify(contextData, null, 2)}
`.trim();

// Rate-limit 
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



export async function sendToGemini(userInput) {
  try {
    const textSnippets = buildTextSnippetsForQuery(userInput);
    const tabularRefs = await getTabularContextForQuery(userInput);

    const systemInstruction =
      `${baseSystemInstruction}\n\nReference Information:\n${txtDataIntro}` +
      (textSnippets ? `\n\n${textSnippets}` : "") +
      (tabularRefs ? `\n\n${tabularRefs}` : "");

    const chat = await ai.chats.create({
      model: "gemini-2.0-flash",
      config: { systemInstruction },
    });

    const result = await withRateLimitRetry(
      () => chat.sendMessage({ message: userInput }),
      { retries: 2 }
    );

    return (result.text || "").trim();
  } catch (err) {
    console.error("sendToGemini error:", err);
    return "Sorry—something went wrong fetching an answer. Please try again in a moment.";
  }
}

export async function sendToGeminiHtml(userInput) {
  const full = await sendToGemini(userInput);

  // 1) URLs from the CITES line
  const labels = extractCitesLabels(full).map(canonicalizeLabel);
  const urls = labelsToUrls(labels);

  // 2) Remove visible CITES line
  const visible = stripCitesLine(full);

  // 3) Turn cites into short anchors (2–3 words max)
  let html = pairedCitesToHtmlLimited(visible);       // paired cites: wrap small span
  html     = wrapStandaloneCitesTwoOrThree(html);     // standalone cites: wrap 2–3 words before tag
  html     = addFallbackLinks(html, urls);            // add one compact link where still missing

  return html;
}
