// src/geminiChat1.jsx
import { GoogleGenAI } from "@google/genai";
import { loadStaticData, buildReferenceText, selectRelevant } from "./loadStaticData";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Base system instruction template
const baseSystemInstruction = `
You are a helpful retirement chatbot named TERAH (The Epic Retirement Ai Helper) that answers questions about everything surrounding retirement in Australia.
Only provide factual, general information from government sources (ATO, Services Australia, MoneySmart, etc).
Never give personal financial advice or recommendations that are extremely personalized. If asked, decline and refer to a licensed financial adviser.

Always:
- Prioritise clarity, empathy, and actionable general guidance specific to Australian retirement laws.
- Respond in short, clear, and concise sentences.
- Do not italicise or bold text, and do not use emojis.
- Be friendly, do not shut down questions unless you are absolutely sure they are asking for personal advice.
- If you cannot do something for compliance reasons, explain why briefly and politely.

Reference Data (read-only, do not invent details):
{STATIC_CONTEXT}
`.trim();

// Proofread system instruction (improved)
const proofreadInstruction = `
You are proofreading a response that was generated using specific reference data that you do not have access to.

IMPORTANT: Be very conservative in correcting the response. Only make changes if you are absolutely certain there is an error.

1. ACCEPTABLE: If the response appears to cite specific data, numbers, or facts from government sources, and does not give personal advice, respond with "ACCEPTABLE".
2. Personal advice: Only flag if the text explicitly tells someone what they should do personally (e.g., "you should withdraw", "I recommend you do X").
3. Factual information: Government rates, thresholds, dates, and statistics should be preserved - these are not financial advice.
4. Do NOT correct specific numbers, dates, or statistics unless you are absolutely certain they contain obvious errors (like impossible dates or clearly wrong calculations).
5. If the response has both a denial and useful information, trim the denial and keep the information.

Only return "ACCEPTABLE" or the corrected text. Do not explain your reasoning.
`.trim();

// Conversation management
const activeConversations = new Map();
const CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

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

// Generate unique conversation ID
function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Build comprehensive system instruction with all context
async function buildComprehensiveSystemInstruction(userInput) {
  await ensureStaticLoaded();
  
  // Get relevant static data based on user input
  const staticRef = selectRelevant(_staticData, userInput, {
    ROW_CAP: 15,           // Slightly higher for system instruction
    MIN_MATCH_SCORE: 0.7,  // Slightly lower threshold for comprehensive context
    MAX_SNIPPETS_PER_TEXT: 5  // More snippets for better coverage
  });

  return baseSystemInstruction
    .replace('{STATIC_CONTEXT}', staticRef);
}

// Create chat instances for a conversation
async function createConversationChats(userInput) {
  const comprehensiveSystemInstruction = await buildComprehensiveSystemInstruction(userInput);
  
  const mainChat = ai.chats.create({
    model: "gemini-2.0-flash",
    config: {
      systemInstruction: comprehensiveSystemInstruction,
    },
  });

  const proofreadChat = ai.chats.create({
    model: "gemini-2.0-flash",
    config: {
      systemInstruction: proofreadInstruction,
    },
  });

  return { mainChat, proofreadChat };
}

// Cleanup expired conversations
function cleanupExpiredConversations() {
  const now = Date.now();
  for (const [conversationId, conversation] of activeConversations) {
    if (now - conversation.createdAt > CONVERSATION_TIMEOUT) {
      activeConversations.delete(conversationId);
      console.log(`Cleaned up expired conversation: ${conversationId}`);
    }
  }
}

// Start a new conversation and return conversation ID
export async function startConversation() {
  try {
    cleanupExpiredConversations();
    const conversationId = generateConversationId();
    
    console.log(`Starting new conversation: ${conversationId}`);
    
    // Store conversation metadata (chats will be created when first message is sent)
    activeConversations.set(conversationId, {
      createdAt: Date.now(),
      mainChat: null,
      proofreadChat: null
    });
    
    return conversationId;
  } catch (error) {
    console.error("Error starting conversation:", error);
    throw error;
  }
}

// Send a message within an existing conversation
export async function sendMessage(conversationId, userInput) {
  try {
    console.log(`sendMessage called for conversation ${conversationId} with input:`, userInput);
    
    if (!conversationId) {
      throw new Error("No conversation ID provided");
    }
    
    let conversation = activeConversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found or expired`);
    }
    
    // Create chat instances on first message (lazy initialization)
    if (!conversation.mainChat || !conversation.proofreadChat) {
      console.log(`Creating chat instances for conversation ${conversationId}`);
      const { mainChat, proofreadChat } = await createConversationChats(userInput);
      conversation.mainChat = mainChat;
      conversation.proofreadChat = proofreadChat;
      activeConversations.set(conversationId, conversation);
    }

    // Send only the user input (context is already in system instruction)
    console.log("Sending user input to Gemini (stage 1):", userInput);
    const result = await conversation.mainChat.sendMessage({ message: userInput });
    const initialText = result.text;
    console.log("Received initial Gemini response:", initialText);

    // Stage 2: Proofread Gemini's response
    const proofreadMessage = `
Text to proofread:
${initialText}
    `.trim();

    console.log("Sending message to Gemini (proofread stage).");
    const proofreadResult = await conversation.proofreadChat.sendMessage({ message: proofreadMessage });
    console.log("Received proofread Gemini response:", proofreadResult.text);

    // If Gemini says "ACCEPTABLE", return the original response
    if (proofreadResult.text.trim().toUpperCase() === "ACCEPTABLE") {
      return initialText;
    }
    return proofreadResult.text;
  } catch (error) {
    console.error("Error in sendMessage:", error);
    throw error;
  }
}

// End a conversation and cleanup resources
export function endConversation(conversationId) {
  try {
    if (activeConversations.has(conversationId)) {
      activeConversations.delete(conversationId);
      console.log(`Ended conversation: ${conversationId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error ending conversation:", error);
    throw error;
  }
}

// Get active conversation count (for monitoring/debugging)
export function getActiveConversationCount() {
  cleanupExpiredConversations();
  return activeConversations.size;
}

// Legacy function incase the better one breaks
export async function sendToGemini(userInput) {
  try {
    console.log("sendToGemini (legacy) called with userInput:", userInput);
    const conversationId = await startConversation();
    const response = await sendMessage(conversationId, userInput);
    endConversation(conversationId);
    return response;
  } catch (error) {
    console.error("Error in sendToGemini (legacy):", error);
    throw error;
  }
}

