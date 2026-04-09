import { motion } from "framer-motion";
import { Bot } from "lucide-react";

interface ResponsePanelProps {
  response: string;
  isAnalyzing: boolean;
}

export function ResponsePanel({ response, isAnalyzing }: ResponsePanelProps) {
  return (
    <div className="glass-card p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">AI Response</h2>
      </div>

      <div className="flex-1 min-h-[200px] bg-secondary/50 rounded-lg p-4 font-mono text-sm leading-relaxed overflow-auto border border-border">
        {isAnalyzing ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="flex gap-1"
            >
              <span className="w-2 h-2 bg-primary rounded-full" />
              <span className="w-2 h-2 bg-primary rounded-full" />
              <span className="w-2 h-2 bg-primary rounded-full" />
            </motion.div>
            Generating response...
          </div>
        ) : response ? (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {response}
          </motion.p>
        ) : (
          <p className="text-muted-foreground italic">Response will appear here after analysis...</p>
        )}
      </div>
    </div>
  );
}
