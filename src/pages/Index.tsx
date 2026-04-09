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
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
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

    // Simulate async processing
    await new Promise((r) => setTimeout(r, 1200));

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
    setIsAnalyzing(false);
    setViewMode("heatmap");
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
