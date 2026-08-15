import { AlertCircle, CheckCircle2, Info, Lightbulb, TriangleAlert, X } from "lucide-react";
import { useStudioStore } from "../store/useStudioStore";

export function Diagnostics() {
  const analysis = useStudioStore((state) => state.analysis);
  const selectNode = useStudioStore((state) => state.selectNode);
  const applyFix = useStudioStore((state) => state.applyFix);
  const close = useStudioStore((state) => state.toggleDiagnostics);
  const items = analysis?.diagnostics ?? [];
  return (
    <aside className="diagnostics-drawer" aria-label="Workflow diagnostics">
      <header>
        <div>
          <span>Diagnostics</span>
          <strong>
            {items.length
              ? `${items.filter((item) => item.severity === "error").length} errors · ${items.filter((item) => item.severity === "warning").length} warnings`
              : "Compile-ready"}
          </strong>
        </div>
        <button onClick={() => close(false)} aria-label="Close diagnostics">
          <X size={16} />
        </button>
      </header>
      <div className="diagnostics-list">
        {!items.length && (
          <div className="diagnostic-empty">
            <CheckCircle2 size={24} />
            <strong>No issues found</strong>
            <span>The current LGIR is structurally compile-ready.</span>
          </div>
        )}
        {items.map((item, index) => {
          const Icon = item.severity === "error" ? AlertCircle : item.severity === "warning" ? TriangleAlert : Info;
          return (
            <article
              key={`${item.code}-${item.nodeId ?? item.edgeId ?? index}`}
              className={`diagnostic ${item.severity}`}
              role={item.nodeId ? "button" : undefined}
              tabIndex={item.nodeId ? 0 : undefined}
              onClick={() => item.nodeId && selectNode(item.nodeId)}
              onKeyDown={(event) => {
                if (item.nodeId && (event.key === "Enter" || event.key === " ")) selectNode(item.nodeId);
              }}
            >
              <Icon size={16} />
              <div>
                <header>
                  <strong>{item.code}</strong>
                  <span>{item.severity}</span>
                  {item.capability && <em>{item.capability}</em>}
                </header>
                <p>{item.message}</p>
                <small>{item.path}</small>
                {item.fix && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void applyFix(item);
                    }}
                  >
                    <Lightbulb size={13} />
                    {item.fix.label}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
