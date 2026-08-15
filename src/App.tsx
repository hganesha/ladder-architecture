import { useEffect } from "react";
import { Studio } from "./components/Studio";
import { Welcome } from "./components/Welcome";
import { useStudioStore } from "./store/useStudioStore";

export default function App() {
  const view = useStudioStore((state) => state.view);
  const openBlank = useStudioStore((state) => state.openBlank);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void useStudioStore.getState().compile();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void (event.shiftKey ? useStudioStore.getState().redo() : useStudioStore.getState().undo());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return view === "gallery" ? <Welcome onBlank={() => void openBlank()} /> : <Studio />;
}
