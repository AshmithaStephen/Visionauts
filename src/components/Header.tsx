import { Activity, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { MODELS, type ModelInfo } from "@/lib/analysis";

interface HeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  totalEcoCarbon: number;
}

export function Header({ selectedModel, onModelChange, totalEcoCarbon }: HeaderProps) {
  return (
    <header className="glass-card px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <Activity className="h-7 w-7 text-primary" />
        </motion.div>
        <h1 className="text-xl font-bold tracking-tight text-glow font-mono">
          TokenScope
        </h1>
        <span className="text-xs text-muted-foreground hidden sm:inline">AI Prompt Analytics</span>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="bg-secondary text-secondary-foreground border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {Object.values(MODELS).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <div className="glass-card px-3 py-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-eco-amber" />
          <span className="text-xs font-mono text-muted-foreground">Eco Total:</span>
          <motion.span
            key={totalEcoCarbon}
            initial={{ scale: 1.3, color: "hsl(var(--eco-amber))" }}
            animate={{ scale: 1, color: "hsl(var(--foreground))" }}
            className="text-sm font-mono font-semibold"
          >
            {totalEcoCarbon.toFixed(3)}g CO₂
          </motion.span>
        </div>
      </div>
    </header>
  );
}
