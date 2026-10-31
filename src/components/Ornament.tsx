import { Sparkles } from "lucide-react";

// Separador dourado elegante
export default function Ornament({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-14 bg-gradient-to-r from-transparent to-gold/60" />
      <Sparkles className="w-3.5 h-3.5 text-gold" />
      <span className="h-px w-14 bg-gradient-to-l from-transparent to-gold/60" />
    </div>
  );
}
