import { Network } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Network size={compact ? 17 : 20} aria-hidden="true" />
      </span>
      <span>
        <strong>Ladder Graph</strong>
        {!compact && <small>Visual workflow compiler</small>}
      </span>
    </div>
  );
}
