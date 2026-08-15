import { yaml } from "@codemirror/lang-yaml";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useStudioStore } from "../store/useStudioStore";

const theme = EditorView.theme({
  "&": { height: "100%", background: "var(--editor-bg)", color: "var(--editor-text)" },
  ".cm-content": { fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "13px", padding: "18px 0" },
  ".cm-gutters": { background: "var(--editor-bg)", color: "var(--editor-gutter)", border: "none" },
  ".cm-activeLine": { background: "var(--editor-active-line)" },
  ".cm-activeLineGutter": { background: "var(--editor-active-gutter)" },
  ".cm-selectionBackground": { background: "var(--editor-selection)" },
  ".cm-focused": { outline: "none" },
});

export function SourceEditor() {
  const source = useStudioStore((state) => state.source);
  const setSource = useStudioStore((state) => state.setSource);
  return (
    <section className="source-panel" aria-label="LGIR YAML source">
      <div className="panel-title">
        <span>LGIR YAML</span>
        <small>canonical source</small>
      </div>
      <CodeMirror
        value={source}
        height="100%"
        extensions={[yaml(), theme, EditorView.lineWrapping]}
        onChange={(value) => void setSource(value)}
        basicSetup={{ foldGutter: true, highlightActiveLine: true, autocompletion: true, bracketMatching: true }}
      />
    </section>
  );
}
