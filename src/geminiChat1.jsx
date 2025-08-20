// src/geminiChat1.jsx
import { GoogleGenAI } from "@google/genai";
import contextData from "./selenium-web-scraper/src/context.json";

// KEEP your teammate's TXT imports, now with SuperConsumersAustralia.txt added
import guide1 from "./Data/ATO.txt?raw";
import scaTxt from "./Data/SuperConsumersAustralia.txt?raw";

// Bring in the tabular references (ALL sheets), built once
import { buildTabularReferenceBlock } from "./loadStaticData";

// Build the TXT reference block (now includes both files)
const txtData = `
--- guide1.txt ---
${guide1}

--- SuperConsumersAustralia.txt ---
${scaTxt}
`;

// Per your request, keeping API key visible here
const ai = new GoogleGenAI({
  apiKey: "AIzaSyBCM-WY7SxEACI95A3g34bGVVLEhJYmVJw",
});

/**
 * We instruct the model to output a hidden "CITES:" line listing the labels of
 * references it used (from either Reference Information or Scraped Sources Catalog).
 * We then map labels -> URLs and append EXACT "(url) (url)" at the end.
 */
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

/** Dynamic/scraped labels → URLs (extend as needed) */
const SCRAPED_LABEL_TO_URL = [
  { label: "Services Australia (Age Pension)", url: "https://www.servicesaustralia.gov.au/age-pension" },
  { label: "ATO (Superannuation – Withdrawing and using your super)", url: "https://www.ato.gov.au/Individuals/Super/In-detail/Withdrawing-and-using-your-super" },
  { label: "MoneySmart (Retirement income sources)", url: "https://moneysmart.gov.au/retirement-income-sources" },
];

/** Static reference label rules (regex → URL) */
const LABEL_TO_URL_RULES = [
  // CSV
  {
    match: /^DSS_Demographics\.csv(?:\s*\/\s*.*)?$/i,
    url: "https://data.gov.au/organization/department-of-social-services",
  },
  // ABS workbook (any sheet)
  {
    match: /^ABS_Retirement_Comparison\.xlsx\s*\/\s*.+/i,
    url: "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/retirement-and-retirement-intentions-australia",
  },
  // Transition workbook (any sheet)
  {
    match: /^Transition_Retirement_Plans\.xlsx\s*\/\s*.+/i,
    url: "https://www.ato.gov.au/api/public/content/0-74828496-dead-4b1a-8503-ffbe95d37398?1755658690387",
  },
  // TXT: ATO guide (your teammate's)
  {
    match: /^(guide1|ATO)\.txt(?:\s*\/\s*.*)?$/i,
    url: "https://www.ato.gov.au/Individuals/Super/In-detail/Withdrawing-and-using-your-super",
  },
  // TXT: Super Consumers Australia (now included)
  {
    match: /^SuperConsumersAustralia\.txt(?:\s*\/\s*.*)?$/i,
    url: "https://superconsumers.com.au/research/superannuation-death-benefit-delays-you-dont-get-paid-faster-if-you-pay-higher-fees/",
  },
];

// Map labels from CITES → unique URLs (dynamic first, then static rules)
function labelsToUrls(labels) {
  const urls = [];

  // exact match for scraped labels
  for (const label of labels) {
    const found = SCRAPED_LABEL_TO_URL.find((s) => s.label === label.trim());
    if (found?.url && !urls.includes(found.url)) urls.push(found.url);
  }

  // regex for static labels
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

// Make "(https://...)" clickable while preserving parentheses + spacing
function toHtmlWithClickableParensUrls(textWithParensUrls) {
  if (!textWithParensUrls) return "";
  return textWithParensUrls.replace(
    /\((https?:\/\/[^\s)]+)\)/g,
    '(<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>)'
  );
}

// Guardrails + scraped context + catalogs (model sees all of these)
const systemInstruction = `
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
`;

// Lazy-init chat so we can await tabular refs first time only
let _chatPromise;

async function getChat() {
  if (_chatPromise) return _chatPromise;

  _chatPromise = (async () => {
    const tabularRefs = await buildTabularReferenceBlock();

    const finalSystemInstruction =
      `${systemInstruction}\n\nReference Information:\n${txtData}` +
      (tabularRefs ? `\n\n${tabularRefs}` : "");

    return ai.chats.create({
      model: "gemini-2.0-flash",
      config: { systemInstruction: finalSystemInstruction },
    });
  })();

  return _chatPromise;
}

// Take model text, pull CITES line, append EXACT " (url) (url)" at the end
function appendParensUrlsFromCites(fullText) {
  const lines = (fullText || "").split(/\r?\n/);
  const citesIdx = lines.findIndex((l) => l.trim().toUpperCase().startsWith("CITES:"));
  const citesLine = citesIdx >= 0 ? lines[citesIdx].trim() : "CITES:";
  const visibleLines = citesIdx >= 0 ? lines.filter((_, i) => i !== citesIdx) : lines;

  const labelsPart = citesLine.slice(6).trim(); // after "CITES:"
  const labels = labelsPart
    ? labelsPart.split("|").map((s) => s.trim()).filter(Boolean)
    : [];

  const urls = labelsToUrls(labels);
  if (!urls.length) return visibleLines.join("\n").trim();

  const tail = " " + urls.map((u) => `(${u})`).join(" "); // EXACT format: (url) (url)
  return visibleLines.join("\n").trim() + tail;
}

// Public API: returns plain text with "(url)" appended
export async function sendToGemini(userInput) {
  const chat = await getChat();
  const result = await chat.sendMessage({ message: userInput });
  return appendParensUrlsFromCites(result.text || "");
}

// Optional: HTML version that makes "(https://...)" clickable
export async function sendToGeminiHtml(userInput) {
  const text = await sendToGemini(userInput);
  return toHtmlWithClickableParensUrls(text);
}
