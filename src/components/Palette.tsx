import { Boxes, ChevronDown, Combine, GitMerge, Layers3, Search, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { NODE_META, PALETTE_ORDER, ROLE_TEMPLATES } from "../lib/nodeMeta";
import { useStudioStore } from "../store/useStudioStore";

export function Palette() {
  const [query, setQuery] = useState("");
  const addNode = useStudioStore((state) => state.addNode);
  const addRole = useStudioStore((state) => state.addRole);
  const addMacro = useStudioStore((state) => state.addMacro);
  const selectedId = useStudioStore((state) => state.selectedNodeId);
  const workflow = useStudioStore((state) => state.analysis?.normalized);
  const selectNode = useStudioStore((state) => state.selectNode);
  const activeGroup = useMemo(() => {
    const selected = workflow?.spec.nodes.find((node) => node.id === selectedId);
    if (selected?.kind === "group") return selected;
    return workflow?.spec.nodes.find((node) => node.kind === "group" && node.config?.members?.includes(selectedId ?? ""));
  }, [selectedId, workflow]);
  const groups = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return PALETTE_ORDER.filter(
      (kind) =>
        !normalized || `${NODE_META[kind].label} ${NODE_META[kind].hint} ${NODE_META[kind].category}`.toLowerCase().includes(normalized),
    );
  }, [query]);
  const roles = useMemo(
    () => ROLE_TEMPLATES.filter((role) => !query || `${role.name} ${role.role} ${role.path}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <aside className="palette panel" aria-label="Node and template palette">
      <div className="panel-title">
        <span>Library</span>
        <small>{ROLE_TEMPLATES.length} agents</small>
      </div>
      <label className="search-field">
        <Search size={14} />
        <span className="sr-only">Search nodes and templates</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search library" />
      </label>
      {activeGroup && (
        <div className="group-context">
          <span>
            Adding inside <strong>{activeGroup.name}</strong>
          </span>
          <button title="Leave group" aria-label="Leave group" onClick={() => selectNode(null)}>
            <X size={13} />
          </button>
        </div>
      )}
      <details open>
        <summary>
          Visual macros <ChevronDown size={13} />
        </summary>
        <div className="macro-grid">
          <button onClick={() => void addMacro("parallel")}>
            <GitMerge size={15} />
            <span>Parallel</span>
          </button>
          <button onClick={() => void addMacro("pipeline")}>
            <Layers3 size={15} />
            <span>Pipeline</span>
          </button>
          <button onClick={() => void addMacro("reduce")}>
            <Combine size={15} />
            <span>Reduce</span>
          </button>
          <button onClick={() => void addMacro("verify")}>
            <ShieldCheck size={15} />
            <span>Verify</span>
          </button>
        </div>
      </details>
      <details open>
        <summary>
          Agent templates · {roles.length} <ChevronDown size={13} />
        </summary>
        <div className="role-tree">
          {roles.map((role) => (
            <button key={role.name} onClick={() => void addRole(role.name)}>
              <Boxes size={13} />
              <span>
                <small>{role.path}</small>
                <strong>{role.name}</strong>
              </span>
            </button>
          ))}
        </div>
      </details>
      <details open>
        <summary>
          Primitives <ChevronDown size={13} />
        </summary>
        <div className="palette-list">
          {groups.map((kind) => {
            const meta = NODE_META[kind];
            return (
              <button key={kind} onClick={() => void addNode(kind)}>
                <span className="palette-dot" style={{ background: meta.color }} />
                <span>
                  <strong>{meta.label}</strong>
                  <small>{meta.hint}</small>
                </span>
              </button>
            );
          })}
        </div>
      </details>
      <div className="palette-foot">
        <span>Edges are contracts.</span>
        <span>Loops require a hard bound.</span>
      </div>
    </aside>
  );
}
