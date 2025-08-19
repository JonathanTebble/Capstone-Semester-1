// src/geminiChat1.jsx
import { GoogleGenAI } from "@google/genai";
import contextData from "./selenium-web-scraper/src/context.json";
import { loadStaticData, buildReferenceText, selectRelevant } from "./loadStaticData";

// IMPORTANT: move your API key to an env var in real projects
// .env: VITE_GEMINI_API_KEY=xxxxxxxx
//const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
// or you can do a john

const ai = new GoogleGenAI({ apiKey: "AIzaSyBCM-WY7SxEACI95A3g34bGVVLEhJYmVJw" });

// System instruction (keep it concise — scraped context goes here)
const systemInstruction = `
You are a helpful retirement chatbot that answers questions about superannuation, age pension, and retirement planning in Australia.
Only provide factual, general information from government sources (ATO, Services Australia, MoneySmart, etc).
Never give personal financial advice or tailored recommendations. If asked, decline and refer to a licensed financial adviser.

Always:
- Avoid personalising answers or making assumptions about the user's situation.
- Prioritise clarity, empathy, and actionable general guidance specific to Australian retirement laws.
- Respond in short, clear, and concise sentences.
- Do not italicise or bold text, and do not use emojis.

Scraped Reference Context (read-only, do not invent details):
${JSON.stringify(contextData, null, 2)}
`.trim();

// Create a single chat instance
const chat = ai.chats.create({
  model: "gemini-2.0-flash",
  config: {
    systemInstruction,
  },
});

// lazy-load and cache the static data
let _staticDataPromise;
let _staticData;

async function ensureStaticLoaded() {
  if (!_staticDataPromise) {
    _staticDataPromise = loadStaticData().then(d => {
      _staticData = d;
      return d;
    });
  }
  return _staticDataPromise;
}

export async function sendToGemini(userInput) {
  await ensureStaticLoaded();

  // QUICK option: include a compact reference every time
  // const staticRef = buildReferenceText(_staticData);

  // SMARTER option: include only relevant bits (simple keyword retrieval)
  const staticRef = selectRelevant(_staticData, userInput);

  const message = `
${userInput}

[Reference Information - Static Data]
${staticRef}
  `.trim();

  const result = await chat.sendMessage({ message });
  return result.text;
}
