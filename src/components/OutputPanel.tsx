import { Check, Clipboard, Download, FileText, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useStudioStore } from "../store/useStudioStore";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function OutputPanel() {
  const result = useStudioStore((state) => state.compileResult);
  const target = useStudioStore((state) => state.target);
  const close = useStudioStore((state) => state.toggleOutput);
  const [copied, setCopied] = useState(false);
  const isCode = target === "python" || target === "typescript";

  return (
    <section className="output-panel" aria-label="Compiled workflow output">
      <header>
        <div>
          <FileText size={16} />
          <span>Compiled {isCode ? "data module" : "workflow"}</span>
          <em>{target}</em>
        </div>
        <div>
          <button
            disabled={!result?.ok}
            onClick={async () => {
              if (!result?.content) return;
              await navigator.clipboard.writeText(result.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? <Check size={14} /> : <Clipboard size={14} />}
            <span>{copied ? "Copied" : isCode ? "Copy code" : "Copy prompt"}</span>
          </button>
          <button disabled={!result?.ok} onClick={() => result?.ok && download(result.suggestedFilename, result.content, result.mimeType)}>
            <Download size={14} />
            <span>Download {target === "python" ? "Python" : target === "typescript" ? "TypeScript" : "Markdown"}</span>
          </button>
          <button className="icon-only" onClick={() => close(false)} aria-label="Close output">
            <X size={16} />
          </button>
        </div>
      </header>
      {result?.ok ? (
        <div className="output-body">
          <aside className="capability-report">
            <div className="compile-ready">
              <ShieldCheck size={18} />
              <span>
                <strong>Ready to copy</strong>
                <small>{result.adapterVersion}</small>
              </span>
            </div>
            <Capability title="Native" values={result.capabilityReport.native} tone="native" />
            <Capability title="Instructional" values={result.capabilityReport.instructional} tone="instructional" />
            {result.capabilityReport.unsupported.length > 0 && (
              <Capability title="Unsupported" values={result.capabilityReport.unsupported} tone="unsupported" />
            )}
            <dl>
              <dt>Source hash</dt>
              <dd>{result.sourceHash.slice(0, 12)}</dd>
              <dt>Compiler</dt>
              <dd>{result.compilerVersion}</dd>
            </dl>
          </aside>
          <pre>
            <code>{result.content}</code>
          </pre>
        </div>
      ) : (
        <div className="output-blocked">
          <strong>Compilation is blocked</strong>
          <span>Resolve error-level diagnostics, then compile again. Ladder Graph never drops unsupported behavior silently.</span>
        </div>
      )}
    </section>
  );
}

function Capability({ title, values, tone }: { title: string; values: string[]; tone: string }) {
  return (
    <section>
      <h3>{title}</h3>
      <div>
        {values.map((value) => (
          <span key={value} className={`capability ${tone}`}>
            {value}
          </span>
        ))}
      </div>
    </section>
  );
}

export { download };
