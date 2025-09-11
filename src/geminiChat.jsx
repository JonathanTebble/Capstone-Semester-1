// src/geminiChat1.jsx
import { GoogleGenAI } from "@google/genai";
import { loadStaticData, buildMediumReferenceText, getMessageSpecificContext } from "./loadStaticData";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Base system instruction template
const baseSystemInstruction = `
You are a helpful retirement chatbot named TERAH (The Epic Retirement Ai Helper) that answers questions about everything surrounding retirement in Australia.
Only provide factual, general information from government sources (ATO, Services Australia, MoneySmart, etc).
Never give personal financial advice or recommendations that are extremely personalized. If asked, decline and refer to a licensed financial adviser.

You may provide general lists or summaries of government supports, services, or options available, as long as you do not make personal recommendations or rank them for an individual's situation.

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

// Build system instruction with medium baseline context
async function buildSystemInstructionWithMediumContext() {
  await ensureStaticLoaded();
  
  // Use medium reference for consistent baseline knowledge across all conversations
  const mediumRef = buildMediumReferenceText(_staticData);

  return baseSystemInstruction
    .replace('{STATIC_CONTEXT}', mediumRef);
}



// Enhanced pattern-based detection for message enhancement
const ENHANCEMENT_PATTERNS = {
  // Quantitative queries - numbers, amounts, rates
  quantitative: /\b(how much|what rate|how many|what amount|what percentage|how expensive|cost|price|fee|charge|\$|dollar|cents|thousand|million|percent|%|rate of|amount of|value of|worth|threshold|limit|cap|minimum|maximum|range|between|from .+ to|up to|at least|no more than|over|under|above|below)\b/i,
  
  // Temporal queries - time, age, dates, when
  temporal: /\b(when can|what age|how old|by age|at age|after age|before age|age \d+|from age|until age|preservation age|pension age|retirement age|early retirement|when do|when will|when should|how long|duration|years|months|timeline|deadline|expiry|expire|start|begin|end|finish|eligibility age|access age)\b/i,
  
  // Procedural queries - how to, steps, processes
  procedural: /\b(how to|how do|steps|step by step|process|procedure|application|apply|form|document|paperwork|requirements|qualify|eligible|criteria|conditions|rules|regulations|law|legal|compliance|submit|lodge|file|claim|request)\b/i,
  
  // Comparative queries - differences, comparisons, options
  comparative: /\b(compare|comparison|difference|different|versus|vs|better|worse|best|worst|pros|cons|advantages|disadvantages|which|what's the|alternative|option|choose|choice|decide|between|rather than|instead of|prefer)\b/i,
  
  // Complex financial topics
  financial: /\b(superannuation|super fund|smsf|industry fund|retail fund|contribution|concessional|non-concessional|salary sacrifice|employer contribution|personal contribution|government co-contribution|spouse contribution|catch-up|carry forward|rollover|consolidate|transfer|investment option|asset allocation|diversification|risk|return|performance|fees|administration|insurance|death benefit|disability|income protection|binding nomination|reversionary|pension|account based|transition to retirement|ttr|allocated pension|annuity|centrelink|age pension|assets test|income test|deeming|taper rate|work bonus|gifting|tax|franking credits|capital gains|assessable income|taxable income|marginal tax rate|medicare levy|surcharge|rebate|offset|deduction)\b/i,
  
  // Retirement lifecycle and access
  lifecycle: /\b(retirement|retire|retiring|retired|early retirement|phased retirement|gradual retirement|workforce|employment|unemployed|job|career|work|working|part-time|full-time|casual|contractor|self-employed|business owner|director|trustee|beneficiary|member|account holder|preservation|access|withdraw|withdrawal|lump sum|pension payments|income stream|commutation|hardship|compassionate|terminal illness|permanent incapacity|temporary incapacity|unemployment|mortgage|medical|financial hardship|severe financial hardship|first home|education|migration)\b/i,
  
  // Technical and administrative
  technical: /\b(rollover|consolidation|transfer|portability|splitting|contribution splitting|downsizer|home downsizer|bring forward|cap|limit|excess|penalty|surcharge|compliance|regulation|legislation|ato|apra|asic|accc|fair work|ombudsman|complaint|dispute|review|appeal|audit|investigation|breach|non-compliance|reporting|statement|balance|transaction|investment|switch|redemption|unit price|market value|administration fee|investment fee|indirect cost ratio|performance fee|buy-sell spread|exit fee|switching fee|advice fee|ongoing fee|commission|conflicted remuneration)\b/i,
  
  // Detail and clarification requests
  detail: /\b(more detail|specific|exactly|precisely|explain|clarify|elaborate|tell me more|what does this mean|what is|define|definition|meaning|example|instance|scenario|case study|illustration|breakdown|summary|overview|comprehensive|detailed|thorough|complete|full|entire|all|everything|anything|nothing|nobody|everybody|someone|anyone|how exactly|why exactly|what exactly|when exactly|where exactly|who exactly)\b/i,
  
  // Urgency and importance indicators
  urgency: /\b(urgent|emergency|asap|immediately|right away|quickly|fast|soon|deadline|due date|time sensitive|important|critical|essential|must|need to|have to|required|mandatory|compulsory|obligation|liability|responsibility|consequences|penalty|fine|charge|interest|late fee)\b/i,
  
  // Problem and concern indicators
  concern: /\b(problem|issue|concern|worry|confused|confusing|unclear|uncertain|unsure|don't understand|can't|cannot|unable|difficulty|trouble|challenge|obstacle|barrier|mistake|error|wrong|incorrect|dispute|disagreement|complaint|dissatisfied|unhappy|frustrated|stressed|anxious|nervous|scared|worried)\b/i
};

// Simple Levenshtein distance calculation for fuzzy matching
function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Check if a word is a fuzzy match for any of the target terms
function fuzzyMatch(word, targets, maxDistance = 2) {
  const wordLower = word.toLowerCase();
  return targets.some(target => {
    if (target.length < 4) return wordLower === target; // Exact match for short words
    const distance = levenshteinDistance(wordLower, target.toLowerCase());
    const threshold = Math.min(maxDistance, Math.floor(target.length * 0.3)); // Max 30% of word length
    return distance <= threshold;
  });
}

// Extract terms from regex patterns for fuzzy matching
function extractTermsFromPattern(pattern) {
  // Convert regex to string and extract terms between word boundaries
  const patternStr = pattern.source;
  // Match terms between parentheses, split by pipes, clean up
  const matches = patternStr.match(/\([^)]+\)/g);
  if (!matches) return [];
  
  const terms = [];
  matches.forEach(match => {
    // Remove parentheses and split by pipe
    const innerTerms = match.slice(1, -1).split('|');
    innerTerms.forEach(term => {
      // Clean up term: remove \b, backslashes, regex special chars
      const cleanTerm = term.replace(/\\b|\\d\+|\\.|\+|\*|\?|\^|\$|\{|\}|\[|\]|\||\\./g, '').trim();
      // Only keep meaningful terms (length > 3, no special regex syntax)
      if (cleanTerm.length > 3 && !cleanTerm.includes('\\') && !cleanTerm.includes('.') && cleanTerm.indexOf(' ') === -1) {
        terms.push(cleanTerm.toLowerCase());
      }
    });
  });
  
  // Remove duplicates and return
  return [...new Set(terms)];
}

// Dynamically generate fuzzy terms from existing patterns
function getFuzzyTerms() {
  const fuzzyTerms = {};
  for (const [category, pattern] of Object.entries(ENHANCEMENT_PATTERNS)) {
    fuzzyTerms[category] = extractTermsFromPattern(pattern);
  }
  return fuzzyTerms;
}

// Determine if a message needs additional context enhancement
function shouldEnhanceMessage(userInput, messageHistory = [], enhancementCount = 0) {
  const input = userInput.toLowerCase();
  
  // Limit enhancements to prevent token bloat
  if (enhancementCount >= 3) return false;
  
  // Always enhance first message
  if (messageHistory.length === 0) return true;
  
  // Check for pattern matches with scoring
  let enhancementScore = 0;
  const patternMatches = {};
  
  for (const [category, pattern] of Object.entries(ENHANCEMENT_PATTERNS)) {
    const matches = input.match(pattern);
    if (matches) {
      patternMatches[category] = matches.length;
      // Weight different categories
      switch (category) {
        case 'quantitative':
        case 'financial':
        case 'technical':
          enhancementScore += matches.length * 2; // High priority
          break;
        case 'temporal':
        case 'procedural':
        case 'lifecycle':
          enhancementScore += matches.length * 1.5; // Medium-high priority
          break;
        case 'comparative':
        case 'urgency':
        case 'concern':
          enhancementScore += matches.length * 1.2; // Medium priority
          break;
        case 'detail':
          enhancementScore += matches.length * 1; // Lower priority but still relevant
          break;
        default:
          enhancementScore += matches.length * 1;
      }
    }
  }
  
  // Add fuzzy matching for common misspellings
  const words = input.split(/\s+/);
  const fuzzyMatches = {};
  const dynamicFuzzyTerms = getFuzzyTerms();
  
  for (const [category, terms] of Object.entries(dynamicFuzzyTerms)) {
    let categoryMatches = 0;
    for (const word of words) {
      if (fuzzyMatch(word, terms)) {
        categoryMatches++;
      }
    }
    
    if (categoryMatches > 0) {
      fuzzyMatches[category] = categoryMatches;
      // Apply same weighting as exact matches but with slightly lower score
      switch (category) {
        case 'quantitative':
        case 'financial':
        case 'technical':
          enhancementScore += categoryMatches * 1.8; // Slightly lower than exact matches
          break;
        case 'temporal':
        case 'procedural':
        case 'lifecycle':
          enhancementScore += categoryMatches * 1.3;
          break;
        case 'comparative':
        case 'urgency':
        case 'concern':
          enhancementScore += categoryMatches * 1.1;
          break;
        case 'detail':
          enhancementScore += categoryMatches * 0.9;
          break;
        default:
          enhancementScore += categoryMatches * 1;
      }
    }
  }
  
  // Log pattern and fuzzy matches for debugging
  if (Object.keys(patternMatches).length > 0 || Object.keys(fuzzyMatches).length > 0) {
    console.log(`Pattern matches:`, patternMatches, `Fuzzy matches:`, fuzzyMatches, `Total score: ${enhancementScore}`);
  }
  
  // Threshold for enhancement (adjust as needed)
  return enhancementScore >= 1;
}

// Create chat instances for a conversation
async function createConversationChats() {
  const systemInstruction = await buildSystemInstructionWithMediumContext();
  
  const mainChat = ai.chats.create({
    model: "gemini-2.0-flash",
    config: {
      systemInstruction: systemInstruction,
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
      proofreadChat: null,
      messageHistory: [],
      enhancementCount: 0
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
      const { mainChat, proofreadChat } = await createConversationChats();
      conversation.mainChat = mainChat;
      conversation.proofreadChat = proofreadChat;
      activeConversations.set(conversationId, conversation);
    }

    // Determine if this message needs enhancement
    await ensureStaticLoaded();
    const needsEnhancement = shouldEnhanceMessage(userInput, conversation.messageHistory, conversation.enhancementCount);
    
    let enhancedMessage = userInput;
    if (needsEnhancement) {
      console.log("Message needs enhancement - getting additional context");
      const relevantContext = getMessageSpecificContext(_staticData, userInput);
      
      enhancedMessage = `${userInput}

[Additional relevant context for this specific question:]
${relevantContext}`;
      
      conversation.enhancementCount++;
      console.log(`Enhanced message (enhancement #${conversation.enhancementCount})`);
    }

    // Add to message history
    conversation.messageHistory.push(userInput);
    // Keep only last 5 messages for performance
    if (conversation.messageHistory.length > 5) {
      conversation.messageHistory = conversation.messageHistory.slice(-5);
    }
    activeConversations.set(conversationId, conversation);

    // Send the (possibly enhanced) message
    console.log("Sending user input to Gemini (stage 1):", needsEnhancement ? "Enhanced message" : "Original message");
    const result = await conversation.mainChat.sendMessage({ message: enhancedMessage });
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

    // Get the final response text
    const finalText = proofreadResult.text.trim().toUpperCase() === "ACCEPTABLE" 
      ? initialText 
      : proofreadResult.text;

    // Generate staticRef for reference highlighting
    const relevantContext = getMessageSpecificContext(_staticData, userInput);
    // Return structured response with both text and staticRef
    return {
      text: finalText,
      staticRef: relevantContext
    };
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

