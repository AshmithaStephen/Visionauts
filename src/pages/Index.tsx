import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import { PromptInput } from "@/components/PromptInput";
import { ResponsePanel } from "@/components/ResponsePanel";
import { AnalyticsSidebar } from "@/components/AnalyticsSidebar";
import { TrimmedPromptModal } from "@/components/TrimmedPromptModal";
import { analyzePrompt } from "@/services/api";
import {
  MODELS,
  countTokens,
  calculateCost,
  calculateEco,
  trimPrompt,
  type TokenAnalysis,
  type CostResult,
  type EcoImpact,
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
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);

  const handleAnalyze = useCallback(async () => {
    if (!prompt.trim()) return;

    setIsAnalyzing(true);
    setViewMode("normal");
    setSavings(null);

    try {
      // Always use gemini-1.5-flash for the actual API call (only model supported by backend).
      // The model dropdown is used locally to recalculate cost & eco estimates.
      const payload = await analyzePrompt({ prompt, model: "gemini-1.5-flash" });
      const model = MODELS[selectedModel];

      const tokenAnalysis = payload.token_scores.map((token) => ({
        word: token.word,
        score: token.score,
        isStopWord: token.score <= 0.1,
      }));

      setTokens(tokenAnalysis);
      setResponse(payload.ai_response);

      // Persist token counts so the useEffect can recalculate on model change
      setInputTokens(payload.metrics.input_tokens);
      setOutputTokens(payload.metrics.output_tokens);

      setCost(calculateCost(payload.metrics.input_tokens, payload.metrics.output_tokens, model));
      setEco(calculateEco(payload.metrics.total_tokens, model));

      // Force view mode to heatmap after analysis
      if (tokenAnalysis.length > 0) {
        setViewMode("heatmap");
      }
    } catch (error: any) {
      console.error("Analysis request failed", error);
      setResponse(`Error: ${error.message}`);
      setTokens([]);
      setCost(null);
      setEco(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [prompt, selectedModel]);

  // ── Recalculate cost & eco whenever the model changes (no re-analysis needed) ──
  useEffect(() => {
    if (inputTokens <= 0) return; // nothing to recalculate yet

    const model = MODELS[selectedModel];
    if (!model) return;

    const totalTokens = inputTokens + outputTokens;
    setCost(calculateCost(inputTokens, outputTokens, model));
    setEco(calculateEco(totalTokens, model));
  }, [selectedModel, inputTokens, outputTokens]);

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
          <span>Pricing benchmarks as of 2024. Live Gemini API analytics enabled.</span>
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
