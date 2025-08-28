// src/geminiChat.jsx (merged)
// — Keeps your reference/citation pipeline

import { GoogleGenAI } from "@google/genai";
import contextData from "./selenium-web-scraper/src/context.json";

import guide1 from "./Data/ATO.txt?raw";
import scaTxt from "./Data/SuperConsumersAustralia.txt?raw";

import { getTabularContextForQuery } from "./loadStaticData";

// Centralised citation helpers (unchanged)
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
// Targeted text snippets
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

const txtDataIntro = `
--- guide1.txt ---
(See targeted ATO.txt snippets below.)

--- SuperConsumersAustralia.txt ---
(See targeted snippets below.)
`.trim();

// ──────────────────────────────────────────────────────────────────────────────
// Gemini client 
// ──────────────────────────────────────────────────────────────────────────────
const ai = new GoogleGenAI({
  apiKey: import.meta.env?.VITE_GEMINI_API_KEY || "AIzaSyBCM-WY7SxEACI95A3g34bGVVLEhJYmVJw",
});

// Keep citation behaviour in main system instruction so HTML linking works
const citationRules = `
CITATION RULES (STRICT):
- Prefer paired cites: [[cite: LABEL]]that short phrase[[/cite]]. Standalone [[cite: LABEL]] is allowed.
- Labels must match "Reference Information" headers or the “Scraped Sources Catalog”.
- Ensure every paragraph has at least one citation.
- After your answer output exactly one line: CITES: label | label
- Do NOT print raw URLs in the answer.
`.trim();

const systemInstruction = `
You are a helpful retirement chatbot that answers questions about superannuation, age pension, and retirement planning in Australia.
Only provide factual, general information from government sources (ATO, Services Australia, MoneySmart, etc).
Never give personal financial advice or tailored recommendations. If asked, decline and refer to a licensed financial adviser.

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

const proofreadInstruction = `
Proofread the following text.
1) If any details are incorrect, rewrite the text to ensure accuracy.
2) Ensure the text does not provide financial advice. If it does, rewrite it as factual, general information only.
3) If the text is accurate and not financial advice, reply ONLY with "ACCEPTABLE".
Return the final, proofread text or "ACCEPTABLE".
`.trim();

// Create the 2 chat instances 
const chat = ai.chats.create({
  model: "gemini-2.0-flash",
  config: { systemInstruction },
});

const proofreadChat = ai.chats.create({
  model: "gemini-2.0-flash",
  config: { systemInstruction: proofreadInstruction },
});

// ──────────────────────────────────────────────────────────────────────────────
// Main API (ALWAYS runs the proofreader; prints exactly as your mate described)
// ──────────────────────────────────────────────────────────────────────────────
export async function sendToGemini(userInput) {
  try {
    const textSnippets = buildTextSnippetsForQuery(userInput);
    const tabularRefs  = await getTabularContextForQuery(userInput);

    const message = `
${userInput}

[Reference Information]
${txtDataIntro}

${textSnippets}

${tabularRefs}
`.trim();

    // Stage 1: initial response
    const result = await chat.sendMessage({ message });
    const initialText = (result.text || "").trim();

    // Stage 2: proofread decision
    const proofreadMessage = `Text to proofread:\n${initialText}`.trim();
    const proofreadResult = await proofreadChat.sendMessage({ message: proofreadMessage });
    const decisionRaw = (proofreadResult.text || "").trim();

    // EXACT console behaviour:
    // - If acceptable → print "acceptable"
    // - Else → print the rewritten text
    const acceptable = /^ACCEPTABLE\b/i.test(decisionRaw);
    if (acceptable) {
      console.log("acceptable");
      return initialText; // show original to the user
    } else {
      console.log(decisionRaw);
      return decisionRaw; // show rewritten to the user
    }
  } catch (err) {
    console.error("Error in sendToGemini:", err);
    return "Sorry—something went wrong fetching an answer. Please try again in a moment.";
  }
}

// Keep your inline-citation HTML post-processing for the UI
export async function sendToGeminiHtml(userInput) {
  const full = await sendToGemini(userInput);

  // 1) extract labels from the CITES line → urls
  const labels = extractCitesLabels(full).map(canonicalizeLabel);
  const urls = labelsToUrls(labels);

  // 2) remove visible CITES line
  const visible = stripCitesLine(full);

  // 3) make short links (2–3 words) + tooltip
  let html = pairedCitesToHtmlLimited(visible);
  html     = wrapStandaloneCitesTwoOrThree(html);
  html     = addFallbackLinks(html, urls);

  return html;
}
