import { useEffect, useState } from "react";
import { useStudioStore } from "../store/useStudioStore";
import { Diagnostics } from "./Diagnostics";
import { GraphCanvas } from "./GraphCanvas";
import { Inspector } from "./Inspector";
import { OutputPanel } from "./OutputPanel";
import { Palette } from "./Palette";
import { SourceEditor } from "./SourceEditor";
import { StorageDialog } from "./StorageDialog";
import { StudioHeader } from "./StudioHeader";

export function Studio() {
  const state = useStudioStore();
  const [storageOpen, setStorageOpen] = useState(false);
  useEffect(() => {
    if (!state.analysis) void useStudioStore.getState().setSource(state.source, false);
  }, [state.analysis, state.source]);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 880px)");
    const closeDesktopPanels = (event?: MediaQueryListEvent) => {
      if (!(event?.matches ?? mobile.matches)) return;
      const current = useStudioStore.getState();
      if (current.paletteOpen) current.togglePalette();
      if (current.inspectorOpen) current.toggleInspector();
    };
    closeDesktopPanels();
    mobile.addEventListener("change", closeDesktopPanels);
    return () => mobile.removeEventListener("change", closeDesktopPanels);
  }, []);

  const closeMobilePanel = () => {
    const current = useStudioStore.getState();
    if (current.paletteOpen) current.togglePalette();
    if (current.inspectorOpen) current.toggleInspector();
  };

  return (
    <main
      className={`studio-shell ${state.paletteOpen ? "palette-visible" : ""} ${state.inspectorOpen ? "inspector-visible" : ""} ${state.outputOpen ? "output-visible" : ""}`}
    >
      <StudioHeader onStorage={() => setStorageOpen(true)} />
      <div className="studio-workspace">
        {state.paletteOpen && <Palette />}
        <section className={`center-workspace mode-${state.centerMode}`}>
          {state.centerMode !== "source" && <GraphCanvas />}
          {state.centerMode !== "canvas" && <SourceEditor />}
        </section>
        {state.inspectorOpen && <Inspector />}
      </div>
      {(state.paletteOpen || state.inspectorOpen) && (
        <button
          className={`mobile-panel-scrim ${state.paletteOpen ? "after-palette" : "before-inspector"}`}
          type="button"
          aria-label="Close open panel"
          onClick={closeMobilePanel}
        />
      )}
      <footer className="studio-statusbar">
        <span>
          {state.analysis?.stats.nodes ?? 0} nodes · {state.analysis?.stats.edges ?? 0} edges · {state.analysis?.stats.maxParallelism ?? 0}{" "}
          max parallel
        </span>
        <span>
          {state.savedAt
            ? `Saved locally ${new Date(state.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Local draft"}
        </span>
        <span className={state.runtime === "wasm" ? "wasm-ready" : "fallback-ready"}>
          {state.runtime === "wasm" ? "Rust/WASM core" : "Safe web core"}
        </span>
      </footer>
      {state.diagnosticsOpen && <Diagnostics />}
      {state.outputOpen && <OutputPanel />}
      {storageOpen && <StorageDialog onClose={() => setStorageOpen(false)} />}
    </main>
  );
}
