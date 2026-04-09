import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { PromptInput } from "@/components/PromptInput";
import { ResponsePanel } from "@/components/ResponsePanel";
import { AnalyticsSidebar } from "@/components/AnalyticsSidebar";
import { TrimmedPromptModal } from "@/components/TrimmedPromptModal";
import {
  MODELS, countTokens, analyzeTfIdf, calculateCost, calculateEco,
  generateMockResponse, trimPrompt,
  type TokenAnalysis, type CostResult, type EcoImpact,
} from "@/lib/analysis";

type ViewMode = "normal" | "heatmap" | "ghost";

export default function Index() {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-1.5-flash");
  const [viewMode, setViewMode] = useState<ViewMode>("normal");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [tokens, setTokens] = useState<TokenAnalysis[]>([]);
  const [response, setResponse] = useState("");
  const [cost, setCost] = useState<CostResult | null>(null);
  const [eco, setEco] = useState<EcoImpact | null>(null);
  const [savings, setSavings] = useState<{ percentage: number; savedCost: number } | null>(null);
  const [showTrimModal, setShowTrimModal] = useState(false);
  const [trimmedText, setTrimmedText] = useState("");

  const handleAnalyze = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsAnalyzing(true);
    setViewMode("normal");
    setSavings(null);

    try {
      const apiResponse = await fetch('http://localhost:8000/api/v1/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          model: selectedModel
        }),
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      const data = await apiResponse.json();

      // Process token scores to match frontend format
      const processedTokens: TokenAnalysis[] = data.token_scores.map((t: { word: string; score: number }) => ({
        word: t.word,
        score: t.score,
        isStopWord: t.score === 0.1
      }));

      // Calculate cost breakdown
      const totalTokens = data.metrics.total_tokens;
      const inputTokens = data.metrics.input_tokens;
      const outputTokens = data.metrics.output_tokens;
      const totalCost = data.metrics.cost_usd;
      const inputRatio = inputTokens / totalTokens;
      const outputRatio = outputTokens / totalTokens;

      const costResult: CostResult = {
        inputTokens,
        outputTokens,
        inputCost: totalCost * inputRatio,
        outputCost: totalCost * outputRatio,
        totalCost
      };

      // Get eco data from backend
      const model = MODELS[selectedModel];
      const ecoResult: EcoImpact = {
        carbonGrams: data.metrics.carbon_g,
        waterMl: data.metrics.water_ml,
        energyWh: data.metrics.energy_wh,
        carbonAnalogy: data.metrics.carbon_g < 1 
          ? `~${(data.metrics.carbon_g * 1000).toFixed(0)}mg — a single breath` 
          : data.metrics.carbon_g < 10 
          ? `Like charging your phone for ${(data.metrics.carbon_g / 8).toFixed(1)} minutes`
          : `Equivalent to driving ${(data.metrics.carbon_g / 200).toFixed(2)} km`,
        waterAnalogy: data.metrics.water_ml < 15 
          ? `About ${Math.ceil(data.metrics.water_ml / 5)} sips of water`
          : data.metrics.water_ml < 250
          ? `~${(data.metrics.water_ml / 250).toFixed(1)} cups of water`
          : `About ${(data.metrics.water_ml / 500).toFixed(1)} water bottles`,
        energyAnalogy: data.metrics.energy_wh < 1
          ? `${(data.metrics.energy_wh * 3600).toFixed(0)} joules — a LED bulb for ${(data.metrics.energy_wh / 0.01 * 36).toFixed(0)}s`
          : `Running a 60W bulb for ${(data.metrics.energy_wh / 60 * 60).toFixed(1)} minutes`
      };

      setTokens(processedTokens);
      setResponse(data.ai_response);
      setCost(costResult);
      setEco(ecoResult);
      setViewMode("heatmap");

    } catch (error) {
      console.error('Analysis failed:', error);
      // Fallback to mock data if API fails
      const model = MODELS[selectedModel];
      const tfidfTokens = analyzeTfIdf(prompt);
      const mockResponse = generateMockResponse(prompt);
      const inputTokenCount = countTokens(prompt);
      const outputTokenCount = countTokens(mockResponse);
      const costResult = calculateCost(inputTokenCount, outputTokenCount, model);
      const ecoResult = calculateEco(inputTokenCount + outputTokenCount, model);

      setTokens(tfidfTokens);
      setResponse(mockResponse);
      setCost(costResult);
      setEco(ecoResult);
      setViewMode("heatmap");
    } finally {
      setIsAnalyzing(false);
    }
  }, [prompt, selectedModel]);

  const handleTrim = useCallback(() => {
    const trimmed = trimPrompt(tokens);
    setTrimmedText(trimmed);

    const originalTokens = countTokens(prompt);
    const trimmedTokens = countTokens(trimmed);
    const model = MODELS[selectedModel];
    const savedTokens = originalTokens - trimmedTokens;
    const savedCost = (savedTokens / 1_000_000) * model.inputCostPer1M;
    const percentage = originalTokens > 0 ? (savedTokens / originalTokens) * 100 : 0;

    setSavings({ percentage, savedCost });
    setShowTrimModal(true);
  }, [tokens, prompt, selectedModel]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-4">
        <Header
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          totalEcoCarbon={eco?.carbonGrams ?? 0}
        />
      </div>

      <div className="flex-1 p-4 pt-0 grid grid-cols-1 lg:grid-cols-[1fr_1fr_280px] gap-4">
        <PromptInput
          prompt={prompt}
          onPromptChange={setPrompt}
          onAnalyze={handleAnalyze}
          onTrim={handleTrim}
          isAnalyzing={isAnalyzing}
          tokens={tokens}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hasAnalysis={tokens.length > 0}
        />
        <ResponsePanel response={response} isAnalyzing={isAnalyzing} />
        <div className="lg:sticky lg:top-4 lg:self-start">
          <AnalyticsSidebar cost={cost} eco={eco} savings={savings} />
        </div>
      </div>

      <footer className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>TokenScope — AI Prompt Analytics Dashboard</span>
          <span>Pricing benchmarks as of 2024. Mock data for MVP.</span>
        </div>
      </footer>

      <TrimmedPromptModal
        isOpen={showTrimModal}
        onClose={() => setShowTrimModal(false)}
        original={prompt}
        trimmed={trimmedText}
        savingsPercent={savings?.percentage ?? 0}
      />
    </div>
  );
}
