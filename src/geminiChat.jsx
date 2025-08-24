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

// Proofread system instruction (improved)
const proofreadInstruction = `
Proofread the following text.
1. If any details are incorrect, rewrite the text to ensure accuracy.
2. Ensure the text does not provide financial advice. If it does, rewrite it as factual, general information only.
3. If the text is accurate and not financial advice, reply ONLY with "ACCEPTABLE".
4. Only rewrite if there is a factual error or financial advice, and ignore minor stylistic or grammatical improvements if they are not impactful.
Only return the final, proofread text or "ACCEPTABLE".
`.trim();

// Create a single chat instance
const chat = ai.chats.create({
  model: "gemini-2.0-flash",
  config: {
    systemInstruction,
  },
});

// Create a second chat instance for proofreading
const proofreadChat = ai.chats.create({
  model: "gemini-2.0-flash",
  config: {
    systemInstruction: proofreadInstruction,
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
  try {
    console.log("sendToGemini called with userInput:", userInput);
    await ensureStaticLoaded();
    console.log("Static data loaded.");

    // SMARTER option: include only relevant bits (simple keyword retrieval)
    const staticRef = selectRelevant(_staticData, userInput);

    const message = `
${userInput}

[Reference Information - Static Data]
${staticRef}
  `.trim();

    // Stage 1: Get initial Gemini response
    console.log("Sending user input to Gemini (stage 1):", userInput);
    const result = await chat.sendMessage({ message });
    const initialText = result.text;
    console.log("Received initial Gemini response:", initialText);

    // Stage 2: Proofread Gemini's response (no static/context data)
    const proofreadMessage = `
Text to proofread:
${initialText}
    `.trim();

    console.log("Sending message to Gemini (proofread stage).");
    const proofreadResult = await proofreadChat.sendMessage({ message: proofreadMessage });
    console.log("Received proofread Gemini response:", proofreadResult.text);

    // If Gemini says "ACCEPTABLE", return the original response
    if (proofreadResult.text.trim().toUpperCase() === "ACCEPTABLE") {
      return initialText;
    }
    return proofreadResult.text;
  } catch (error) {
    console.error("Error in sendToGemini:", error);
    throw error;
  }
}

