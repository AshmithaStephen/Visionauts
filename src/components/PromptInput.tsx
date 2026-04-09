import { useState } from "react";
import { Play, Scissors, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import type { TokenAnalysis } from "@/lib/analysis";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ViewMode = "normal" | "heatmap" | "ghost";

interface PromptInputProps {
  prompt: string;
  onPromptChange: (val: string) => void;
  onAnalyze: () => void;
  onTrim: () => void;
  isAnalyzing: boolean;
  tokens: TokenAnalysis[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  hasAnalysis: boolean;
}

export function PromptInput({
  prompt, onPromptChange, onAnalyze, onTrim,
  isAnalyzing, tokens, viewMode, onViewModeChange, hasAnalysis,
}: PromptInputProps) {
  const modes: { key: ViewMode; label: string }[] = [
    { key: "normal", label: "Normal" },
    { key: "heatmap", label: "Heat-Map" },
    { key: "ghost", label: "Ghost" },
  ];

  function getTokenClass(score: number): string {
    if (viewMode === "heatmap") {
      if (score >= 0.6) return "heat-high";
      if (score >= 0.3) return "heat-med";
      return "heat-low";
    }
    if (viewMode === "ghost" && score >= 0 && score < 0.2) {
      return "ghost-token";
    }
    return "";
  }

  return (
    <div className="glass-card p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Prompt Input</h2>
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => onViewModeChange(m.key)}
              className={`px-3 py-1 text-xs font-mono rounded-md transition-all ${
                viewMode === m.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {hasAnalysis && viewMode !== "normal" ? (
        <div className="flex-1 min-h-[200px] bg-secondary/50 rounded-lg p-4 font-mono text-sm leading-relaxed overflow-auto border border-border">
          {tokens.map((t, i) =>
            t.score === -1 ? (
              <span key={i}>{t.word}</span>
            ) : (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <span className={`${getTokenClass(t.score)} rounded px-0.5 cursor-default transition-all`}>
                    {t.word}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="font-mono text-xs">
                  TF-IDF: {t.score.toFixed(3)}
                </TooltipContent>
              </Tooltip>
            )
          )}
        </div>
      ) : (
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Paste your prompt here..."
          className="flex-1 min-h-[200px] bg-secondary/50 rounded-lg p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary border border-border"
        />
      )}

      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAnalyze}
          disabled={isAnalyzing || !prompt.trim()}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg font-semibold text-sm disabled:opacity-40 transition-opacity"
        >
          {isAnalyzing ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
              <RotateCcw className="h-4 w-4" />
            </motion.div>
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isAnalyzing ? "Analyzing..." : "Analyze"}
        </motion.button>

        {hasAnalysis && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onTrim}
            className="flex items-center gap-2 bg-eco-green/20 text-eco-green border border-eco-green/30 px-4 py-3 rounded-lg font-semibold text-sm"
          >
            <Scissors className="h-4 w-4" />
            Trim Prompt
          </motion.button>
        )}
      </div>
    </div>
  );
}
