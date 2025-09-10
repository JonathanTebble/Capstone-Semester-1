// src/loadStaticData.js
import Papa from "papaparse";
import * as XLSX from "xlsx";

// --- TEXT (kept as-is; you already do this) ---
import atoTxt from "./Data/ATO.txt?raw";
import scaTxt from "./Data/SuperConsumersAustralia.txt?raw";

// --- CSV (import as raw text, then parse) ---
import demographicsCsvRaw from "./Data/dss-demographics-2021-sa2-june-2025.csv?raw";

// --- JSON (direct import) ---
import leavingWorkforce from "./Data/Leaving_The_Workforce.json";

// --- Excel (fetch as URL, read ArrayBuffer with xlsx) ---
import absUrl from "./Data/ABS_Retirement_Comparison.xlsx?url";
import trpUrl from "./Data/Transition_Retirement_Plans.xlsx?url";



// Configurable parameters for content selection
const CONFIG = {
  ROW_CAP: 50,                    // max rows per dataset
  CHAR_CAP_TEXT: 20000,          // max characters per text source
  SNIPPET_WINDOW: 200,           // characters around each match for context
  MAX_SNIPPETS_PER_TEXT: 10,      // max text snippets per source
  MIN_MATCH_SCORE: 0.1,          // minimum relevance score to include
  CONTEXT_PADDING: 50,           // extra characters for sentence boundaries
  CONTENT_AGGRESSIVENESS: 3.0,   // multiplier for content inclusion (higher = more content)
};

export async function loadStaticData() {
  // CSV → array of objects
  const demographicsCsv = Papa.parse(demographicsCsvRaw, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  }).data;

  // Excel → array of objects (first sheet)
  const [absBuf, trpBuf] = await Promise.all([
    fetch(absUrl).then(r => r.arrayBuffer()),
    fetch(trpUrl).then(r => r.arrayBuffer()),
  ]);

  const absWb = XLSX.read(absBuf, { type: "array" });
  const trpWb = XLSX.read(trpBuf, { type: "array" });

  const abs = XLSX.utils.sheet_to_json(absWb.Sheets[absWb.SheetNames[0]], { defval: "" });
  const trp = XLSX.utils.sheet_to_json(trpWb.Sheets[trpWb.SheetNames[0]], { defval: "" });

  return {
    texts: {
      ATO: atoTxt,
      SuperConsumersAustralia: scaTxt,
    },
    csv: {
      demographics: demographicsCsv,
    },
    excel: {
      ABS_Retirement_Comparison: abs,
      Transition_Retirement_Plans: trp,
    },
    json: {
      Leaving_The_Workforce: leavingWorkforce,
    },
  };
}

// Compact reference text for generic queries (much smaller)
export function buildReferenceText(data) {
  const parts = [];

  // Process all text files dynamically
  for (const [key, content] of Object.entries(data.texts)) {
    parts.push(
      `--- ${key}.txt (summary) ---\n${content.slice(0, 200)}...`
    );
  }

  // Process all CSV files dynamically
  for (const [key, csvData] of Object.entries(data.csv)) {
    const sampleRows = csvData.slice(0, 2);
    parts.push(
      `--- ${key} CSV (sample of 2 rows) ---\n` +
        sampleRows.map(r => JSON.stringify(r)).join("\n")
    );
  }

  // Process all JSON files dynamically
  for (const [key, jsonData] of Object.entries(data.json)) {
    parts.push(
      `--- ${key}.json (summary) ---\n` +
        JSON.stringify(jsonData, null, 2).slice(0, 300) + "..."
    );
  }

  // Process all Excel files dynamically
  for (const [key, excelData] of Object.entries(data.excel)) {
    parts.push(
      `--- ${key}.xlsx (sample of 2 rows) ---\n` +
        JSON.stringify(excelData.slice(0, 2))
    );
  }

  const result = parts.join("\n\n");
  return result;
}

// Medium-sized reference for follow-up questions
export function buildMediumReferenceText(data) {
  const parts = [];

  // Process all text files dynamically with medium excerpts
  for (const [key, content] of Object.entries(data.texts)) {
    parts.push(
      `--- ${key}.txt (key sections) ---\n${content.slice(0, 1000)}...`
    );
  }

  // Process all JSON files dynamically with more comprehensive excerpts
  for (const [key, jsonData] of Object.entries(data.json)) {
    parts.push(
      `--- ${key}.json (key sections) ---\n` +
        JSON.stringify(jsonData, null, 2).slice(0, 2000) + "..."
    );
  }

  const result = parts.join("\n\n");
  return result;
}

// Enhanced query parsing and text processing functions
function parseQuery(query) {
  const q = String(query || "").toLowerCase();
  if (!q) return { terms: [], phrases: [], isEmpty: true };
  
  // Extract phrases in quotes
  const phrases = [];
  const phraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = phraseRegex.exec(q)) !== null) {
    phrases.push(match[1]);
  }
  
  // Remove phrases and split remaining into terms
  const withoutPhrases = q.replace(phraseRegex, '').trim();
  const terms = withoutPhrases ? withoutPhrases.split(/\s+/).filter(t => t.length > 1) : [];
  
  // Check if query is too generic/short to be useful for retrieval
  const veryGenericTerms = ['why', 'what', 'how', 'when', 'where', 'who', 'can', 'will', 'should', 'would', 'could', 'do', 'does', 'did', 'is', 'are', 'was', 'were', 'yes', 'no', 'ok', 'okay', 'thanks', 'thank'];
  const meaningfulTerms = terms.filter(term => !veryGenericTerms.includes(term) && term.length > 2);
  
  // More nuanced generic detection - only consider truly generic if:
  // 1. No meaningful terms AND no phrases AND
  // 2. Query is very short (1-2 words) OR only contains stop words
  const isVeryShort = terms.length <= 2;
  const onlyStopWords = meaningfulTerms.length === 0;
  const isTooGeneric = onlyStopWords && phrases.length === 0 && isVeryShort;
  
  return { 
    terms, 
    phrases, 
    isEmpty: terms.length === 0 && phrases.length === 0,
    isTooGeneric,
    meaningfulTerms
  };
}

function calculateRelevanceScore(text, terms, phrases) {
  const lowerText = text.toLowerCase();
  let score = 0;
  
  // Phrase matches get higher weight
  phrases.forEach(phrase => {
    const matches = (lowerText.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    score += matches * 2; // Double weight for phrases
  });
  
  // Term matches
  terms.forEach(term => {
    const matches = (lowerText.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    score += matches;
  });
  
  // Normalize by text length (TF-IDF style)
  return score / Math.max(text.length / 1000, 1);
}

function extractTextSnippets(text, terms, phrases) {
  if (!text) return [];
  
  const allQueries = [...terms, ...phrases];
  const snippets = [];
  
  for (const query of allQueries) {
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;
    
    while ((match = regex.exec(text)) !== null && snippets.length < CONFIG.MAX_SNIPPETS_PER_TEXT) {
      const start = Math.max(0, match.index - CONFIG.SNIPPET_WINDOW);
      const end = Math.min(text.length, match.index + match[0].length + CONFIG.SNIPPET_WINDOW);
      
      // Expand to sentence boundaries
      let expandedStart = start;
      let expandedEnd = end;
      
      // Find sentence start
      while (expandedStart > 0 && !/[.!?]\s/.test(text.substring(expandedStart - 2, expandedStart))) {
        expandedStart--;
        if (start - expandedStart > CONFIG.CONTEXT_PADDING) break;
      }
      
      // Find sentence end
      while (expandedEnd < text.length && !/[.!?]\s/.test(text.substring(expandedEnd, expandedEnd + 2))) {
        expandedEnd++;
        if (expandedEnd - end > CONFIG.CONTEXT_PADDING) break;
      }
      
      const snippet = text.substring(expandedStart, expandedEnd).trim();
      if (snippet.length > 50) { // Avoid tiny snippets
        snippets.push({
          text: snippet,
          score: calculateRelevanceScore(snippet, terms, phrases),
          position: match.index
        });
      }
    }
  }
  
  // Remove duplicates and sort by score
  const uniqueSnippets = snippets
    .filter((snippet, index, arr) => 
      !arr.slice(0, index).some(prev => Math.abs(prev.position - snippet.position) < 100)
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG.MAX_SNIPPETS_PER_TEXT);
  
  return uniqueSnippets;
}

function matchesStructuredData(obj, terms, phrases, weightedFields = {}) {
  if (!obj || typeof obj !== 'object') return { matches: false, score: 0 };
  
  let totalScore = 0;
  let hasMatch = false;
  
  // Improved term filtering - less aggressive, keep demographic terms
  const veryGenericTerms = ['the', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'from', 'with', 'by', 'if', 'am', 'is', 'are', 'was', 'were', 'me', 'my', 'you', 'your', 'tell'];
  const filteredTerms = terms.filter(term => !veryGenericTerms.includes(term) && term.length > 1); // Reduced length requirement
  
  // Add synonym mapping for better demographic matching
  const synonymMap = {
    'males': ['men', 'male'],
    'females': ['women', 'female'],
    'age': ['aged', 'years'],
    'over': ['above', '+'],
    'under': ['below', 'less'],
    'change': ['transition', 'move', 'switch'],
    'work': ['employment', 'job', 'career'],
    'retirement': ['retire', 'retiring', 'retired']
  };
  
  // Expand terms with synonyms
  const expandedTerms = [...filteredTerms];
  filteredTerms.forEach(term => {
    if (synonymMap[term]) {
      expandedTerms.push(...synonymMap[term]);
    }
  });
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    
    const stringValue = String(value).toLowerCase();
    const fieldWeight = weightedFields[key] || 1;
    
    // Check phrases (keep full phrase matching)
    for (const phrase of phrases) {
      if (stringValue.includes(phrase)) {
        hasMatch = true;
        totalScore += 2 * fieldWeight;
      }
    }
    
    // Check expanded terms (including synonyms)
    for (const term of expandedTerms) {
      if (stringValue.includes(term)) {
        hasMatch = true;
        totalScore += 1 * fieldWeight;
      }
    }
  }
  
  return { matches: hasMatch, score: totalScore };
}

function findRelevantEntities(text, terms, phrases) {
  const entities = {};
  const allQueries = [...terms, ...phrases];
  
  // Simple regex patterns for common entities
  const patterns = {
    dates: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g,
    percentages: /\b\d+(?:\.\d+)?%\b/g,
    amounts: /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g,
    ages: /\b(?:age|aged)\s+(\d{1,3})\b/gi
  };
  
  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = text.match(pattern);
    if (matches && allQueries.some(q => text.toLowerCase().includes(q))) {
      entities[type] = [...new Set(matches)]; // Remove duplicates
    }
  }
  
  return entities;
}

// Enhanced retrieval function with multiple improvements
export function selectRelevant(data, query, options = {}) {
  const config = { ...CONFIG, ...options };
  const queryInfo = parseQuery(query);
  
  if (queryInfo.isEmpty || queryInfo.isTooGeneric) {
    return buildReferenceText(data);
  }
  
  const { terms, phrases, meaningfulTerms } = queryInfo;
  
  // If query has few meaningful terms but isn't completely generic, use medium reference
  if (meaningfulTerms.length === 0 && phrases.length === 0) {
    return buildReferenceText(data);
  }
  
  // If query has 1-2 meaningful terms, might be follow-up - use medium reference as fallback
  const isLikelyFollowUp = meaningfulTerms.length <= 2 && terms.length > 2;
  
  const results = [];
  
  // Enhanced text processing - dynamic for all text files
  const textSources = Object.entries(data.texts).map(([name, content]) => ({ name: `${name}.txt`, content }));
  
  for (const source of textSources) {
    const snippets = extractTextSnippets(source.content, terms, phrases);
    const relevantSnippets = snippets.filter(s => s.score >= config.MIN_MATCH_SCORE);
    
    if (relevantSnippets.length > 0) {
      const entities = findRelevantEntities(source.content, terms, phrases);
      const entityText = Object.keys(entities).length > 0 
        ? `\n[Relevant entities: ${JSON.stringify(entities)}]` 
        : '';
      
      results.push({
        section: `--- ${source.name} (${relevantSnippets.length} relevant snippets) ---`,
        content: relevantSnippets.map(s => `• ${s.text}`).join('\n\n') + entityText,
        score: relevantSnippets.reduce((sum, s) => sum + s.score, 0)
      });
    }
  }
  
  // Enhanced structured data filtering - dynamic for all CSV files
  for (const [csvKey, csvData] of Object.entries(data.csv)) {
    // Apply weights if this is demographics data, otherwise use default
    const weights = csvKey === 'demographics' ? 
      { 'SA2_NAME_2021': 3, 'LGA_NAME_2021': 2, 'STATE_NAME_2021': 2 } : {};
    
    const scoredRows = csvData
      .map(row => {
        const result = matchesStructuredData(row, terms, phrases, weights);
        return { ...row, _relevanceScore: result.score, _matches: result.matches };
      })
      .filter(row => row._matches && row._relevanceScore >= (config.MIN_MATCH_SCORE * (1.5 / config.CONTENT_AGGRESSIVENESS)))
      .sort((a, b) => b._relevanceScore - a._relevanceScore)
      .slice(0, Math.floor(config.ROW_CAP * config.CONTENT_AGGRESSIVENESS));
    
    if (scoredRows.length > 0) {
      results.push({
        section: `--- ${csvKey} CSV (${scoredRows.length} matching rows, sorted by relevance) ---`,
        content: scoredRows.map(row => {
          const { _relevanceScore, _matches, ...cleanRow } = row;
          return JSON.stringify(cleanRow);
        }).join('\n'),
        score: scoredRows.reduce((sum, row) => sum + row._relevanceScore, 0)
      });
    }
  }
  
  // Enhanced Excel data processing - dynamic for all Excel files
  for (const [excelKey, excelData] of Object.entries(data.excel)) {
    const scoredRows = excelData
      .map(row => {
        const result = matchesStructuredData(row, terms, phrases);
        return { ...row, _relevanceScore: result.score, _matches: result.matches };
      })
      .filter(row => row._matches && row._relevanceScore >= (config.MIN_MATCH_SCORE * (2 / config.CONTENT_AGGRESSIVENESS)))
      .sort((a, b) => b._relevanceScore - a._relevanceScore)
      .slice(0, Math.floor(config.ROW_CAP * config.CONTENT_AGGRESSIVENESS));
    
    if (scoredRows.length > 0) {
      results.push({
        section: `--- ${excelKey}.xlsx (${scoredRows.length} matching rows, sorted by relevance) ---`,
        content: JSON.stringify(scoredRows.map(row => {
          const { _relevanceScore, _matches, ...cleanRow } = row;
          return cleanRow;
        })),
        score: scoredRows.reduce((sum, row) => sum + row._relevanceScore, 0)
      });
    }
  }
  
  // JSON data with scoring - dynamic for all JSON files
  for (const [jsonKey, jsonData] of Object.entries(data.json)) {
    const jsonResult = matchesStructuredData(jsonData, terms, phrases);
    if (jsonResult.matches && jsonResult.score >= config.MIN_MATCH_SCORE) {
      results.push({
        section: `--- ${jsonKey}.json (relevance score: ${jsonResult.score.toFixed(2)}) ---`,
        content: JSON.stringify(jsonData, null, 2).slice(0, config.CHAR_CAP_TEXT),
        score: jsonResult.score
      });
    }
  }
  
  // Sort results by relevance score and return
  if (results.length === 0) {
    if (isLikelyFollowUp) {
      return buildMediumReferenceText(data);
    } else {
      return buildReferenceText(data);
    }
  }
  
  results.sort((a, b) => b.score - a.score);
  return results.map(r => `${r.section}\n${r.content}`).join('\n\n');
}
