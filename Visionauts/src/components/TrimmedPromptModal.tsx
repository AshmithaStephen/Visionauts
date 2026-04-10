import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check } from "lucide-react";
import { useState } from "react";

interface TrimmedPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  original: string;
  trimmed: string;
  savingsPercent: number;
}

export function TrimmedPromptModal({ isOpen, onClose, original, trimmed, savingsPercent }: TrimmedPromptModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(trimmed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card p-6 max-w-2xl w-full max-h-[80vh] overflow-auto space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Optimized Prompt</h3>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="glass-card p-3 bg-eco-green/5 border-eco-green/20">
              <p className="text-sm text-eco-green font-mono">
                ✂️ {savingsPercent.toFixed(1)}% tokens trimmed — lower cost & carbon footprint
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Trimmed Prompt</p>
              <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm border border-border">
                {trimmed}
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold w-full justify-center"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy Trimmed Prompt"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
