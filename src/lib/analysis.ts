// Model definitions
export interface ModelInfo {
  id: string;
  name: string;
  inputCostPer1M: number;  // USD per 1M input tokens
  outputCostPer1M: number; // USD per 1M output tokens
  carbonPer1kTokens: number; // grams CO2
}

export const MODELS: Record<string, ModelInfo> = {
  "gpt-4o": { id: "gpt-4o", name: "GPT-4o", inputCostPer1M: 5, outputCostPer1M: 15, carbonPer1kTokens: 0.5 },
  "gpt-3.5-turbo": { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", inputCostPer1M: 0.5, outputCostPer1M: 1.5, carbonPer1kTokens: 0.15 },
  "gemini-1.5-flash": { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", inputCostPer1M: 0.075, outputCostPer1M: 0.3, carbonPer1kTokens: 0.2 },
};

// Simple tokenizer (approximation: ~4 chars per token for English)
export function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// TF-IDF analysis
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "but", "and", "or", "if", "while", "that", "this",
  "these", "those", "it", "its", "i", "me", "my", "we", "our", "you",
  "your", "he", "him", "his", "she", "her", "they", "them", "their",
  "what", "which", "who", "whom", "about", "up"
]);

export interface TokenAnalysis {
  word: string;
  score: number;
  isStopWord: boolean;
}

export function analyzeTfIdf(text: string): TokenAnalysis[] {
  const words = text.split(/(\s+)/);
  const cleanWords = words.filter(w => w.trim()).map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ""));
  
  // Term frequency
  const tf: Record<string, number> = {};
  const totalWords = cleanWords.filter(w => w).length;
  cleanWords.forEach(w => {
    if (w) tf[w] = (tf[w] || 0) + 1;
  });
  
  // IDF simulation (using inverse frequency in document)
  const uniqueWords = new Set(cleanWords.filter(w => w));
  const idf: Record<string, number> = {};
  uniqueWords.forEach(w => {
    idf[w] = Math.log(totalWords / (tf[w] || 1)) + 1;
  });

  return words.map(word => {
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!clean || /^\s+$/.test(word)) {
      return { word, score: -1, isStopWord: false }; // whitespace
    }
    const isStop = STOP_WORDS.has(clean);
    const tfidf = isStop ? 0.05 : Math.min(((tf[clean] || 0) / totalWords) * (idf[clean] || 1), 1);
    const normalized = Math.min(tfidf * 2.5, 1); // scale up for visibility
    return { word, score: isStop ? Math.min(normalized, 0.15) : normalized, isStopWord: isStop };
  });
}

// Cost calculation
export interface CostResult {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export function calculateCost(inputTokens: number, outputTokens: number, model: ModelInfo): CostResult {
  const inputCost = (inputTokens / 1_000_000) * model.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPer1M;
  return { inputTokens, outputTokens, inputCost, outputCost, totalCost: inputCost + outputCost };
}

// Eco impact
export interface EcoImpact {
  carbonGrams: number;
  waterMl: number;
  energyWh: number;
  carbonAnalogy: string;
  waterAnalogy: string;
  energyAnalogy: string;
}

export function calculateEco(totalTokens: number, model: ModelInfo): EcoImpact {
  const carbonGrams = (totalTokens / 1000) * model.carbonPer1kTokens;
  const waterMl = totalTokens * 0.5;
  const energyWh = totalTokens * 0.001;

  const carbonAnalogy = carbonGrams < 1 
    ? `~${(carbonGrams * 1000).toFixed(0)}mg — a single breath` 
    : carbonGrams < 10 
    ? `Like charging your phone for ${(carbonGrams / 8).toFixed(1)} minutes`
    : `Equivalent to driving ${(carbonGrams / 200).toFixed(2)} km`;
  
  const waterAnalogy = waterMl < 15 
    ? `About ${Math.ceil(waterMl / 5)} sips of water`
    : waterMl < 250
    ? `~${(waterMl / 250).toFixed(1)} cups of water`
    : `About ${(waterMl / 500).toFixed(1)} water bottles`;

  const energyAnalogy = energyWh < 1
    ? `${(energyWh * 3600).toFixed(0)} joules — a LED bulb for ${(energyWh / 0.01 * 36).toFixed(0)}s`
    : `Running a 60W bulb for ${(energyWh / 60 * 60).toFixed(1)} minutes`;

  return { carbonGrams, waterMl, energyWh, carbonAnalogy, waterAnalogy, energyAnalogy };
}

// Mock AI response
export function generateMockResponse(prompt: string): string {
  const responses = [
    `Based on your prompt, here's a comprehensive analysis. The key considerations involve multiple factors that need careful evaluation. First, let's examine the primary aspects of your request and break them down into actionable components. The data suggests several optimization opportunities that could improve efficiency by approximately 15-25%. Additionally, there are environmental considerations worth noting when processing large volumes of text through language models.`,
    `Great question! Let me walk you through the main points. When analyzing this type of query, we typically consider the semantic density, token distribution, and overall prompt efficiency. Your prompt demonstrates moderate complexity with room for optimization. The most impactful change would be reducing redundant phrasing, which accounts for roughly 20% of total token usage. I recommend focusing on concise, direct language to maximize value per token spent.`,
    `Here's my detailed response to your query. The analysis reveals several interesting patterns in how the prompt is structured. Key findings include: (1) approximately 30% of tokens are functional words that could be optimized, (2) the core semantic content represents about 45% of the total token count, and (3) there are opportunities to reduce costs by reformulating certain phrases. Overall, the prompt is well-structured but could benefit from targeted trimming.`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Trim prompt (remove ghost tokens)
export function trimPrompt(tokens: TokenAnalysis[], threshold: number = 0.2): string {
  return tokens
    .filter(t => t.score === -1 || t.score >= threshold)
    .map(t => t.word)
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}
