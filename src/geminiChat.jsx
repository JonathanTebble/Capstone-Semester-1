import { GoogleGenAI } from "@google/genai";
import contextData from "./selenium-web-scraper/src/context.json";

const ai = new GoogleGenAI({ apiKey: "AIzaSyBCM-WY7SxEACI95A3g34bGVVLEhJYmVJw" });

const systemInstruction = `
You are a helpful retirement chatbot that answers questions about superannuation, age pension, and retirement planning in Australia. This is general information based on publicly available government sources such as the ATO and MoneySmart. It is not personal financial advice. For advice tailored to your situation, please speak with a licensed financial adviser.

Always prioritize clarity, empathy, and actionable financial guidance specific to Australian retirement laws, in short responses.

Reference Context:
${JSON.stringify(contextData, null, 2)}
`;

const chat = ai.chats.create({
  model: "gemini-2.0-flash",
  config: {
    systemInstruction: systemInstruction,
  },
});

export async function sendToGemini(userInput) {
  const result = await chat.sendMessage({ message: userInput });
  return result.text;
}