import { motion } from "framer-motion";
import { Hash, DollarSign, Leaf, Droplets, Zap, TrendingDown } from "lucide-react";
import type { CostResult, EcoImpact } from "@/lib/analysis";

interface AnalyticsSidebarProps {
  cost: CostResult | null;
  eco: EcoImpact | null;
  savings: { percentage: number; savedCost: number } | null;
}

function StatCard({ icon: Icon, label, value, subtext, color }: {
  icon: React.ElementType; label: string; value: string; subtext?: string; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 space-y-2"
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-mono font-bold">{value}</p>
      {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
    </motion.div>
  );
}

export function AnalyticsSidebar({ cost, eco, savings }: AnalyticsSidebarProps) {
  if (!cost) {
    return (
      <div className="glass-card p-5 flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground text-sm text-center font-mono">
          Run an analysis to<br />see metrics here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Dashboard</h2>

      <StatCard icon={Hash} label="Input Tokens" value={cost.inputTokens.toLocaleString()} color="text-primary" />
      <StatCard icon={Hash} label="Output Tokens" value={cost.outputTokens.toLocaleString()} color="text-primary" />
      <StatCard
        icon={DollarSign} label="Total Cost"
        value={`$${cost.totalCost.toFixed(6)}`}
        subtext={`In: $${cost.inputCost.toFixed(6)} | Out: $${cost.outputCost.toFixed(6)}`}
        color="text-eco-amber"
      />

      {eco && (
        <>
          <div className="border-t border-border my-2" />
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider px-1">Sustainability</h3>
          <StatCard icon={Leaf} label="Carbon Emitted" value={`${eco.carbonGrams.toFixed(4)}g`} subtext={eco.carbonAnalogy} color="text-eco-green" />
          <StatCard icon={Droplets} label="Water Consumed" value={`${eco.waterMl.toFixed(1)}ml`} subtext={eco.waterAnalogy} color="text-eco-blue" />
          <StatCard icon={Zap} label="Energy Used" value={`${eco.energyWh.toFixed(4)}Wh`} subtext={eco.energyAnalogy} color="text-eco-amber" />
        </>
      )}

      {savings && (
        <>
          <div className="border-t border-border my-2" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 border-eco-green/30 border space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-eco-green" />
              <span className="text-xs text-eco-green uppercase tracking-wider font-semibold">Potential Savings</span>
            </div>
            <p className="text-2xl font-mono font-bold text-eco-green">{savings.percentage.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Save ~${savings.savedCost.toFixed(6)} per request</p>
          </motion.div>
        </>
      )}
    </div>
  );
}
