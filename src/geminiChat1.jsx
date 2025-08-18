import { GoogleGenAI } from "@google/genai";
import contextData from "./selenium-web-scraper/src/context.json";
//import fs from "fs";

// Load all .txt files from a specified directory
import guide1 from './Data/ATO.txt?raw';
//import guide2 from './Data/guide2.txt?raw';

// Combine all imported text into one reference source
const txtData = `
--- guide1.txt ---
${guide1}`;

// API setup
const ai = new GoogleGenAI({ apiKey: "AIzaSyBCM-WY7SxEACI95A3g34bGVVLEhJYmVJw" });

// System instruction with strict "general information only" rule
const systemInstruction = `
You are a helpful retirement chatbot that answers questions about superannuation, age pension, and retirement planning in Australia. 
You must only provide factual, general information based on publicly available government sources such as the ATO and MoneySmart. 
You must never give personal financial advice, predictions, or recommendations tailored to an individual. 
If the user asks for personal advice, politely decline and refer them to a licensed financial adviser.

Always:
- Avoid personalising answers or making assumptions about the user's situation.
- Prioritise clarity, empathy, and actionable general guidance specific to Australian retirement laws.
- Respond in short, clear, and concise sentences.
- Do not italicise or bold text, and do not use emojis.

Reference Context:
${JSON.stringify(contextData, null, 2)}
`;

// Create chat with system instruction + txt data
const chat = ai.chats.create({
  model: "gemini-2.0-flash",
  config: {
    systemInstruction: `${systemInstruction}\n\nReference Information:\n${txtData}`,
  },
});

export async function sendToGemini(userInput) {
  const result = await chat.sendMessage({ message: userInput });
  return result.text;
}
