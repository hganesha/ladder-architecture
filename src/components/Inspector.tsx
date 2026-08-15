import { Braces, Cable, Check, FileInput, Plug, Plus, Search, Settings2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type CapabilityOption, recommendedCapabilities, TARGET_CAPABILITY_CATALOGS } from "../lib/capabilityCatalog";
import { useStudioStore } from "../store/useStudioStore";
import type { CapabilityCustomization, LgirNode } from "../types";

type FormNode = LgirNode & {
  capabilities: {
    skills: string[];
    tools: string[];
    connectors: string[];
    permissions: string[];
    customizations: Record<string, CapabilityCustomization>;
  };
  config: NonNullable<LgirNode["config"]>;
};

function normalized(node: LgirNode): FormNode {
  return {
    ...node,
    capabilities: {
      skills: node.capabilities?.skills ?? [],
      tools: node.capabilities?.tools ?? [],
      connectors: node.capabilities?.connectors ?? [],
      permissions: node.capabilities?.permissions ?? [],
      customizations: node.capabilities?.customizations ?? {},
    },
    config: node.config ?? {},
  };
}

export function Inspector() {
  const selectedId = useStudioStore((state) => state.selectedNodeId);
  const workflow = useStudioStore((state) => state.analysis?.normalized);
  const patchNode = useStudioStore((state) => state.patchNode);
  const tab = useStudioStore((state) => state.inspectorTab);
  const setTab = useStudioStore((state) => state.setInspectorTab);
  const target = useStudioStore((state) => state.target);
  const selected = useMemo(() => workflow?.spec.nodes.find((node) => node.id === selectedId), [workflow, selectedId]);
  const [draft, setDraft] = useState<FormNode | null>(selected ? normalized(selected) : null);
  useEffect(() => setDraft(selected ? normalized(selected) : null), [selected]);

  if (!draft) {
    return (
      <aside className="inspector panel empty-inspector">
        <div className="panel-title">
          <span>Inspector</span>
          <small>nothing selected</small>
        </div>
        <div>
          <FileInput size={22} />
          <h2>Workflow overview</h2>
          <p>Select a node to edit its instructions and contracts.</p>
        </div>
        <WorkflowOverview />
      </aside>
    );
  }

  const commit = (patch: Partial<LgirNode>) => void patchNode(draft.id, patch);
  const setField = <K extends keyof FormNode>(key: K, value: FormNode[K]) =>
    setDraft((state) => (state ? { ...state, [key]: value } : state));
  const tabs = [
    { id: "basics" as const, label: "Basics", icon: FileInput },
    { id: "contracts" as const, label: "Contracts", icon: Braces },
    { id: "capabilities" as const, label: "Capabilities", icon: Cable },
    { id: "advanced" as const, label: "Advanced", icon: Settings2 },
  ];
  const catalog = TARGET_CAPABILITY_CATALOGS[target];
  const recommendations = recommendedCapabilities(target, draft);
  const updateCapability = (key: "skills" | "connectors", value: string[]) => {
    const previous = new Set(draft.capabilities[key]);
    const next = new Set(value);
    const options = key === "skills" ? catalog.skills : catalog.connectors;
    const customizations = { ...draft.capabilities.customizations };
    value.forEach((id) => {
      if (previous.has(id) || customizations[id]) return;
      const template = options.find((option) => option.id === id);
      customizations[id] = {
        template: template?.id ?? (key === "skills" ? "custom-skill" : "custom-connector"),
        instructions:
          template?.description ??
          (key === "skills"
            ? "Apply this named skill only within the node contract and return its declared output."
            : "Use this connector only when explicitly provided by the host and never broaden its permissions."),
      };
    });
    previous.forEach((id) => {
      if (!next.has(id)) delete customizations[id];
    });
    const capabilities = { ...draft.capabilities, [key]: value, customizations };
    setDraft({ ...draft, capabilities });
    commit({ capabilities });
  };
  const updateCustomization = (id: string, customization: CapabilityCustomization) => {
    const capabilities = {
      ...draft.capabilities,
      customizations: { ...draft.capabilities.customizations, [id]: customization },
    };
    setDraft({ ...draft, capabilities });
    commit({ capabilities });
  };

  return (
    <aside className="inspector panel" aria-label={`Inspector for ${draft.name}`}>
      <div className="panel-title">
        <span>Node contract</span>
        <small>{draft.kind}</small>
      </div>
      <div className="inspector-tabs" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} title={label} onClick={() => setTab(id)}>
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="inspector-body">
        {tab === "basics" && (
          <>
            <Field label="Title">
              <input
                value={draft.name}
                onChange={(event) => setField("name", event.target.value)}
                onBlur={() => commit({ name: draft.name })}
              />
            </Field>
            <Field label="Summary">
              <textarea
                rows={3}
                value={draft.summary ?? ""}
                onChange={(event) => setField("summary", event.target.value)}
                onBlur={() => commit({ summary: draft.summary })}
              />
            </Field>
            {(draft.kind === "agent" || draft.kind === "evaluate") && (
              <>
                <Field label="Role">
                  <input
                    value={draft.role ?? ""}
                    onChange={(event) => setField("role", event.target.value)}
                    onBlur={() => commit({ role: draft.role })}
                  />
                </Field>
                <Field label="Prompt">
                  <textarea
                    rows={8}
                    value={draft.prompt ?? ""}
                    onChange={(event) => setField("prompt", event.target.value)}
                    onBlur={() => commit({ prompt: draft.prompt })}
                  />
                </Field>
              </>
            )}
            {draft.kind === "condition" && (
              <Field label="Condition">
                <input
                  value={draft.config.expression ?? ""}
                  onChange={(event) => setDraft({ ...draft, config: { ...draft.config, expression: event.target.value } })}
                  onBlur={() => commit({ config: draft.config })}
                />
              </Field>
            )}
          </>
        )}
        {tab === "contracts" && (
          <>
            <JsonField label="Input schema" value={draft.inputSchema} onCommit={(value) => commit({ inputSchema: value })} />
            <JsonField label="Output schema" value={draft.outputSchema} onCommit={(value) => commit({ outputSchema: value })} />
            <p className="field-help">JSON Schema is descriptive in target prompts and validated structurally by Ladder Graph.</p>
          </>
        )}
        {tab === "capabilities" && (
          <>
            <div className="harness-capability-card">
              <div>
                <span>Target catalog</span>
                <strong>{catalog.label}</strong>
              </div>
              <p>
                {catalog.artifactDescription}
                <br />
                Skills from <code>{catalog.skillLocation}</code>
                <br />
                {catalog.connectorLocation}
              </p>
            </div>
            <CapabilityPicker
              icon="skill"
              label="Skills"
              options={catalog.skills}
              recommended={recommendations.skills}
              value={draft.capabilities.skills}
              onChange={(value) => updateCapability("skills", value)}
              placeholder="Add repository skill ID"
            />
            <CapabilityPicker
              icon="connector"
              label="Connectors"
              options={catalog.connectors}
              recommended={recommendations.connectors}
              value={draft.capabilities.connectors}
              onChange={(value) => updateCapability("connectors", value)}
              placeholder="Add connector or MCP ID"
            />
            <CapabilityCustomizations
              skills={draft.capabilities.skills}
              connectors={draft.capabilities.connectors}
              values={draft.capabilities.customizations}
              skillTemplates={catalog.skills}
              connectorTemplates={catalog.connectors}
              onChange={updateCustomization}
            />
            <ListField
              label="Primitive tools"
              value={draft.capabilities.tools}
              onCommit={(value) => commit({ capabilities: { ...draft.capabilities, tools: value } })}
            />
            <ListField
              label="Permissions"
              value={draft.capabilities.permissions}
              onCommit={(value) => commit({ capabilities: { ...draft.capabilities, permissions: value } })}
            />
            <div className="callout">
              <strong>{target === "python" || target === "typescript" ? "Deterministic declaration" : "No ambient authority"}</strong>
              <span>
                Templates and custom instructions are embedded in the artifact. Ladder Graph never installs, grants, imports, or invokes
                them.
              </span>
            </div>
          </>
        )}
        {tab === "advanced" && <Advanced node={draft} setNode={setDraft} commit={commit} />}
      </div>
    </aside>
  );
}

function CapabilityCustomizations({
  skills,
  connectors,
  values,
  skillTemplates,
  connectorTemplates,
  onChange,
}: {
  skills: string[];
  connectors: string[];
  values: Record<string, CapabilityCustomization>;
  skillTemplates: CapabilityOption[];
  connectorTemplates: CapabilityOption[];
  onChange: (id: string, value: CapabilityCustomization) => void;
}) {
  const items = [
    ...skills.map((id) => ({ id, kind: "skill" as const, templates: skillTemplates })),
    ...connectors.map((id) => ({ id, kind: "connector" as const, templates: connectorTemplates })),
  ];
  if (!items.length) return null;
  return (
    <section className="capability-customizations" aria-labelledby="capability-customizations-title">
      <div className="capability-picker-title">
        <span id="capability-customizations-title">
          <Settings2 size={14} /> Template customizations
        </span>
        <small>{items.length} available</small>
      </div>
      <p>Every selection resolves to a base template plus node-specific instructions.</p>
      {items.map(({ id, kind, templates }) => {
        const option = templates.find((candidate) => candidate.id === id);
        const value =
          values[id] ??
          ({
            template: option?.id ?? (kind === "skill" ? "custom-skill" : "custom-connector"),
            instructions:
              option?.description ??
              (kind === "skill"
                ? "Apply this named skill only within the node contract and return its declared output."
                : "Use this connector only when explicitly provided by the host and never broaden its permissions."),
          } satisfies CapabilityCustomization);
        return (
          <details key={`${kind}-${id}`}>
            <summary>
              <span>{option?.label ?? id}</span>
              <code>{value.template}</code>
            </summary>
            <label>
              Base template
              <select value={value.template} onChange={(event) => onChange(id, { ...value, template: event.target.value })}>
                <option value={kind === "skill" ? "custom-skill" : "custom-connector"}>Custom {kind} contract</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Customized instructions
              <textarea
                rows={4}
                value={value.instructions}
                onChange={(event) => onChange(id, { ...value, instructions: event.target.value })}
              />
            </label>
          </details>
        );
      })}
    </section>
  );
}

function CapabilityPicker({
  icon,
  label,
  options,
  recommended,
  value,
  onChange,
  placeholder,
}: {
  icon: "skill" | "connector";
  label: string;
  options: CapabilityOption[];
  recommended: Set<string>;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const selected = new Set(value);
  const filtered = options.filter((option) =>
    `${option.label} ${option.id} ${option.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const Icon = icon === "skill" ? Sparkles : Plug;
  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((item) => item !== id) : [...value, id]);
  const addCustom = () => {
    const id = custom.trim();
    if (!id || selected.has(id)) return;
    onChange([...value, id]);
    setCustom("");
  };

  return (
    <section className="capability-picker" aria-labelledby={`capability-${label.toLowerCase()}`}>
      <div className="capability-picker-title">
        <span id={`capability-${label.toLowerCase()}`}>
          <Icon size={14} /> {label}
        </span>
        <small>{value.length} selected</small>
      </div>
      {value.length > 0 && (
        <ul className="capability-chips" aria-label={`Selected ${label.toLowerCase()}`}>
          {value.map((id) => (
            <li className="capability-chip" key={id}>
              {options.find((option) => option.id === id)?.label ?? id}
              <button type="button" aria-label={`Remove ${id}`} onClick={() => onChange(value.filter((item) => item !== id))}>
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="capability-search">
        <Search size={13} aria-hidden="true" />
        <span className="sr-only">Search {label.toLowerCase()}</span>
        <input value={query} placeholder={`Search ${label.toLowerCase()}`} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="capability-options">
        {filtered.map((option) => {
          const active = selected.has(option.id);
          return (
            <button
              className={`capability-option ${active ? "selected" : ""}`}
              type="button"
              aria-pressed={active}
              key={option.id}
              onClick={() => toggle(option.id)}
            >
              <span className="capability-option-icon">{active ? <Check size={12} /> : <Plus size={12} />}</span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
                <code>{option.id}</code>
              </span>
              {recommended.has(option.id) && <em>Recommended</em>}
            </button>
          );
        })}
      </div>
      <form
        className="capability-custom"
        onSubmit={(event) => {
          event.preventDefault();
          addCustom();
        }}
      >
        <input value={custom} placeholder={placeholder} onChange={(event) => setCustom(event.target.value)} />
        <button type="submit" disabled={!custom.trim()} aria-label={`Add custom ${label.toLowerCase()}`}>
          <Plus size={13} />
        </button>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ListField({ label, value, onCommit }: { label: string; value: string[]; onCommit: (value: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  return (
    <Field label={label}>
      <input
        value={text}
        placeholder="comma, separated"
        onChange={(event) => setText(event.target.value)}
        onBlur={() =>
          onCommit(
            text
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
      />
    </Field>
  );
}

function JsonField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: Record<string, unknown> | null | undefined;
  onCommit: (value: Record<string, unknown> | null) => void;
}) {
  const [text, setText] = useState(value ? JSON.stringify(value, null, 2) : "");
  const [error, setError] = useState("");
  useEffect(() => {
    setText(value ? JSON.stringify(value, null, 2) : "");
    setError("");
  }, [value]);
  const commit = () => {
    try {
      onCommit(text.trim() ? (JSON.parse(text) as Record<string, unknown>) : null);
      setError("");
    } catch {
      setError("Enter valid JSON before leaving this field.");
    }
  };
  return (
    <Field label={label}>
      <textarea
        className="mono-field"
        rows={9}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        aria-invalid={Boolean(error)}
      />
      {error && <small className="field-error">{error}</small>}
    </Field>
  );
}

function Advanced({
  node,
  setNode,
  commit,
}: {
  node: FormNode;
  setNode: (node: FormNode) => void;
  commit: (patch: Partial<LgirNode>) => void;
}) {
  const update = (key: string, value: unknown) => setNode({ ...node, config: { ...node.config, [key]: value } });
  return (
    <>
      <Field label="Stable node ID">
        <input value={node.id} readOnly />
      </Field>
      {node.kind === "loop" && (
        <>
          <Field label="Body node IDs">
            <input
              value={(node.config.body ?? []).join(", ")}
              onChange={(event) =>
                update(
                  "body",
                  event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
              onBlur={() => commit({ config: node.config })}
            />
          </Field>
          <Field label="Exit condition">
            <input
              value={node.config.exitCondition ?? ""}
              onChange={(event) => update("exitCondition", event.target.value)}
              onBlur={() => commit({ config: node.config })}
            />
          </Field>
          <Field label="Maximum iterations">
            <input
              type="number"
              min={0}
              max={100}
              value={node.config.maxIterations ?? 0}
              onChange={(event) => update("maxIterations", Number(event.target.value))}
              onBlur={() => commit({ config: node.config })}
            />
          </Field>
          <Field label="On exhausted">
            <select
              value={node.config.onExhausted ?? "stop"}
              onChange={(event) => {
                update("onExhausted", event.target.value);
                setTimeout(() => commit({ config: { ...node.config, onExhausted: event.target.value as "stop" } }), 0);
              }}
            >
              <option value="stop">Stop</option>
              <option value="warn">Warn and return best</option>
              <option value="continue">Continue</option>
            </select>
          </Field>
        </>
      )}
      {node.kind === "join" && (
        <Field label="Join policy">
          <select
            value={node.config.join ?? "all"}
            onChange={(event) => commit({ config: { ...node.config, join: event.target.value as "all" } })}
          >
            <option value="all">All successful</option>
            <option value="allSettled">All settled</option>
            <option value="first">First result</option>
          </select>
        </Field>
      )}
      {node.kind === "group" && (
        <>
          <Field label="Execution mode">
            <select
              value={node.config.execution ?? "parallel"}
              onChange={(event) => commit({ config: { ...node.config, execution: event.target.value as "parallel" | "sequential" } })}
            >
              <option value="parallel">Parallel</option>
              <option value="sequential">Sequential</option>
            </select>
          </Field>
          <Field label="Exit strategy">
            <select
              value={node.config.exit ?? "aggregate"}
              onChange={(event) => commit({ config: { ...node.config, exit: event.target.value as "aggregate" | "serialize" } })}
            >
              <option value="aggregate">Aggregate member outputs</option>
              <option value="serialize">Serialize member outputs</option>
            </select>
          </Field>
          <Field label="Member node IDs">
            <input
              value={(node.config.members ?? []).join(", ")}
              onChange={(event) =>
                update(
                  "members",
                  event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
              onBlur={() => commit({ config: node.config })}
            />
          </Field>
          <p className="field-help">Select this group or one of its members before adding a primitive to place it inside.</p>
        </>
      )}
      {node.kind === "transform" && (
        <>
          <Field label="Operation">
            <select
              value={node.config.operation ?? "select"}
              onChange={(event) => commit({ config: { ...node.config, operation: event.target.value as "select" } })}
            >
              {["select", "rename", "merge", "filter", "deduplicate", "sort", "slice"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Declarative expression">
            <input
              value={node.config.expression ?? ""}
              onChange={(event) => update("expression", event.target.value)}
              onBlur={() => commit({ config: node.config })}
            />
          </Field>
        </>
      )}
      <p className="field-help">Advanced configuration is still data. Arbitrary scripts are never accepted or executed.</p>
    </>
  );
}

function WorkflowOverview() {
  const workflow = useStudioStore((state) => state.analysis?.normalized);
  const stats = useStudioStore((state) => state.analysis?.stats);
  if (!workflow) return null;
  return (
    <div className="workflow-overview">
      <span>Workflow</span>
      <strong>{workflow.metadata.title || workflow.metadata.name}</strong>
      <p>{workflow.spec.objective}</p>
      <div>
        <span>
          <b>{stats?.nodes}</b> nodes
        </span>
        <span>
          <b>{stats?.agents}</b> agents
        </span>
        <span>
          <b>{stats?.loops}</b> loops
        </span>
      </div>
    </div>
  );
}
