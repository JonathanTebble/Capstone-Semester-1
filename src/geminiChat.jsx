// src/geminiChat.jsx

import { GoogleGenAI } from "@google/genai";
import contextData from "./selenium-web-scraper/src/context.json";

import guide1 from "./Data/ATO.txt?raw";
import scaTxt from "./Data/SuperConsumersAustralia.txt?raw";

import { getTabularContextForQuery } from "./loadStaticData";

import {
  detectUsedSourcesFromContext,
  applyInlineRefsToPlainText,
} from "./utils/refEngine";

// ──────────────────────────────────────────────────────────────────────────────
// Targeted text snippets
// ──────────────────────────────────────────────────────────────────────────────
const TEXT_SNIPPET_MAX_PER_SOURCE = 10;
const TEXT_SNIPPET_MAX_CHARS_TOTAL = 8000;

function tokenize(q) { return (q || "").toLowerCase().match(/[a-z0-9%]+/g)?.filter(Boolean) ?? []; }
function splitParas(txt) { return (txt || "").split(/\n\s*\n+/g).map(s => s.trim()).filter(Boolean); }
function paraMatches(para, tokens) {
  if (!tokens.length) return true;
  const hay = para.toLowerCase(); let hits = 0; for (const t of tokens) if (hay.includes(t)) hits++;
  return hits >= Math.min(2, tokens.length);
}
function pickParas(text, tokens, cap = TEXT_SNIPPET_MAX_PER_SOURCE) {
  const out = []; for (const p of splitParas(text)) { if (paraMatches(p, tokens)) { out.push(p); if (out.length >= cap) break; } }
  return out;
}

//!!!
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

const systemInstruction = `
You are a helpful retirement chatbot that answers questions about superannuation, age pension, and retirement planning in Australia.
Only provide factual, general information from government or reputable sources (ATO, Services Australia, MoneySmart, ABS, etc).
Never give personal financial advice or tailored recommendations. If asked, decline and suggest talking to a licensed financial adviser.

Always:
- Avoid personalising answers or making assumptions about the user's situation.
- Prioritise clarity, empathy, and actionable general guidance specific to Australian retirement laws.
- Respond in short, clear sentences. No bold/italics/emojis.


`.trim();

// const systemInstruction = `
// You are a helpful retirement chatbot that answers questions about superannuation, age pension, and retirement planning in Australia.
// Only provide factual, general information from government sources (ATO, Services Australia, MoneySmart, etc).
// Never give personal financial advice or tailored recommendations. If asked, decline and refer to a licensed financial adviser.

// Always:
// - Avoid personalising answers or making assumptions about the user's situation.
// - Prioritise clarity, empathy, and actionable general guidance specific to Australian retirement laws.
// - Respond in short, clear, and concise sentences.
// - Do not italicise or bold text, and do not use emojis.

// ${citationRules}

// Scraped Sources Catalog (label :: url):
// ${SCRAPED_LABEL_TO_URL.map((s) => `- ${s.label} :: ${s.url}`).join("\n")}

// Scraped Reference Context (read-only JSON):
// ${JSON.stringify(contextData, null, 2)}
// `.trim();

const proofreadInstruction = `
Proofread the following text.
1) If any details are incorrect, rewrite the text to ensure accuracy.
2) Ensure the text does not provide financial advice. If it does, rewrite it as factual, general information only.
3) If the text is accurate and not financial advice, reply ONLY with "ACCEPTABLE".
Return the final, proofread text or "ACCEPTABLE".
`.trim();

const chat = ai.chats.create({ model: "gemini-2.0-flash", config: { systemInstruction } });
const proofreadChat = ai.chats.create({ model: "gemini-2.0-flash", config: { systemInstruction: proofreadInstruction } });

// // Create the 2 chat instances 
// const chat = ai.chats.create({
//   model: "gemini-2.0-flash",
//   config: { systemInstruction },
// });

// const proofreadChat = ai.chats.create({
//   model: "gemini-2.0-flash",
//   config: { systemInstruction: proofreadInstruction },
// });

// ──────────────────────────────────────────────────────────────────────────────
// Public API
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

    // Decide which local sources were surfaced for THIS query
    const usedSourceIds = detectUsedSourcesFromContext(`${textSnippets}\n\n${tabularRefs}`);

    // Stage 1: initial response
    const result = await chat.sendMessage({ message });
    const initialText = (result.text || "").trim();

    // Stage 2: proofread decision
    const proofreadMessage = `Text to proofread:\n${initialText}`.trim();
    const proofreadResult = await proofreadChat.sendMessage({ message: proofreadMessage });
    const decisionRaw = (proofreadResult.text || "").trim();

    const acceptable = /^ACCEPTABLE\b/i.test(decisionRaw);
    const finalText = acceptable ? initialText : decisionRaw;
    if (acceptable) console.log("acceptable"); else console.log(decisionRaw);

    return { text: finalText, usedSourceIds };
  } catch (err) {
    console.error("Error in sendToGemini:", err);
    return { text: "Sorry—something went wrong fetching an answer. Please try again in a moment.", usedSourceIds: [] };
  }
}

// Keep the same signature your UI already calls (second arg ignored safely)
export async function sendToGeminiHtml(userInput, _opts) {
  const { text, usedSourceIds } = await sendToGemini(userInput);
  // Inject deterministic inline links (max 4 by default)
  const html = applyInlineRefsToPlainText(text, usedSourceIds, 4);
  return html;
}
