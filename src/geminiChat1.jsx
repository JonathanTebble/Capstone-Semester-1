// geminiChat1.jsx
import { GoogleGenAI } from "@google/genai";
import contextData from "./selenium-web-scraper/src/context.json";
import guide1 from "./Data/ATO.txt?raw";
import scaTxt from "./Data/SuperConsumersAustralia.txt?raw";
import { getTabularContextForQuery } from "./loadStaticData";

// Static TXT reference block
const txtData = `
--- guide1.txt ---
${guide1}

--- SuperConsumersAustralia.txt ---
${scaTxt}
`.trim();

// Prefer env var; falls back if needed (but do move to env in production)
const ai = new GoogleGenAI({
  apiKey: import.meta.env?.VITE_GEMINI_API_KEY || "AIzaSyBCM-WY7SxEACI95A3g34bGVVLEhJYmVJw",
});

/** Dynamic/scraped labels → URLs */
const SCRAPED_LABEL_TO_URL = [
  { label: "Services Australia (Age Pension)", url: "https://www.servicesaustralia.gov.au/age-pension" },
  { label: "ATO (Superannuation – Withdrawing and using your super)", url: "https://www.ato.gov.au/Individuals/Super/In-detail/Withdrawing-and-using-your-super" },
  { label: "MoneySmart (Retirement income sources)", url: "https://moneysmart.gov.au/retirement-income-sources" },
];

/** Static label rules → URLs */
const LABEL_TO_URL_RULES = [
  { match: /^DSS_Demographics\.csv(?:\s*\/\s*.*)?$/i,
    url: "https://data.gov.au/organization/department-of-social-services" },
  { match: /^ABS_Retirement_Comparison\.xlsx\s*\/\s*.+/i,
    url: "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/retirement-and-retirement-intentions-australia" },
  { match: /^Transition_Retirement_Plans\.xlsx\s*\/\s*.+/i,
    url: "https://www.ato.gov.au/api/public/content/0-74828496-dead-4b1a-8503-ffbe95d37398?1755658690387" },
  { match: /^(guide1|ATO)\.txt(?:\s*\/\s*.*)?$/i,
    url: "https://www.ato.gov.au/individuals-and-families/jobs-and-employment-types/working-as-an-employee/leaving-the-workforce/planning-to-retire" },
  { match: /^SuperConsumersAustralia\.txt(?:\s*\/\s*.*)?$/i,
    url: "https://superconsumers.com.au/research/superannuation-death-benefit-delays-you-dont-get-paid-faster-if-you-pay-higher-fees/" },
];

function labelsToUrls(labels) {
  const urls = [];
  for (const label of labels) {
    const found = SCRAPED_LABEL_TO_URL.find((s) => s.label === label.trim());
    if (found?.url && !urls.includes(found.url)) urls.push(found.url);
  }
  for (const label of labels) {
    const trimmed = label.trim();
    for (const rule of LABEL_TO_URL_RULES) {
      if (rule.match.test(trimmed)) {
        if (!urls.includes(rule.url)) urls.push(rule.url);
        break;
      }
    }
  }
  return urls;
}

const citationRules = `
CITATION RULES (STRICT):
- After your answer, output one line that begins with exactly: CITES:
- On the same line after "CITES:", list the exact label(s) you relied on,
  taken verbatim from either:
  (a) the "Reference Information" headers (e.g., "ABS_Retirement_Comparison.xlsx / Sheet1", "SuperConsumersAustralia.txt"), or
  (b) the "Scraped Sources Catalog" below (e.g., "Services Australia (Age Pension)").
- Separate multiple labels with a single pipe character: |
  Example: CITES: ABS_Retirement_Comparison.xlsx / Sheet1 | SuperConsumersAustralia.txt
- Do NOT include URLs, Markdown, or any other text on the CITES line.
- If you used none of the provided references, output: CITES:
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

// —— Rate-limit friendly wrapper ——
function parseRetryDelayMs(err) {
  try {
    const details = err?.error?.details || err?.details || [];
    const retryInfo = details.find(d => d['@type']?.includes('google.rpc.RetryInfo'));
    if (!retryInfo?.retryDelay) return null;
    // retryDelay like "47s" or "1.2s"
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
      // eslint-disable-next-line no-console
      console.warn(`Rate-limited (429). Retrying in ${Math.round(delay/1000)}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// — Formatting helpers —
function toHtmlWithClickableParensUrls(text) {
  if (!text) return "";
  return text.replace(
    /\((https?:\/\/[^\s)]+)\)/g,
    '(<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>)'
  );
}

function appendParensUrlsFromCites(fullText) {
  const lines = (fullText || "").split(/\r?\n/);
  const citesIdx = lines.findIndex((l) => l.trim().toUpperCase().startsWith("CITES:"));
  const citesLine = citesIdx >= 0 ? lines[citesIdx].trim() : "CITES:";
  const visibleLines = citesIdx >= 0 ? lines.filter((_, i) => i !== citesIdx) : lines;

  const labelsPart = citesLine.slice(6).trim();
  const labels = labelsPart ? labelsPart.split("|").map((s) => s.trim()).filter(Boolean) : [];

  const urls = labelsToUrls(labels);
  if (!urls.length) return visibleLines.join("\n").trim();

  const tail = " " + urls.map((u) => `(${u})`).join(" ");
  return visibleLines.join("\n").trim() + tail;
}

// — Public API —
export async function sendToGemini(userInput) {
  try {
    // Build query-aware tabular context for THIS question
    const tabularRefs = await getTabularContextForQuery(userInput);

    // Compose systemInstruction with static TXT + filtered tables
    const systemInstruction =
      `${baseSystemInstruction}\n\nReference Information:\n${txtData}` +
      (tabularRefs ? `\n\n${tabularRefs}` : "");

    // Create chat and send message with rate-limit retries
    const chat = await ai.chats.create({
      model: "gemini-2.0-flash",
      config: { systemInstruction },
    });

    const result = await withRateLimitRetry(
      () => chat.sendMessage({ message: userInput }),
      { retries: 2 }
    );

    return appendParensUrlsFromCites(result.text || "");
  } catch (err) {
    console.error("sendToGemini error:", err);
    return "Sorry—something went wrong fetching an answer. Please try again in a moment.";
  }
}

export async function sendToGeminiHtml(userInput) {
  const text = await sendToGemini(userInput);
  return toHtmlWithClickableParensUrls(text);
}
