import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { Braces, GitMerge, Layers3 } from "lucide-react";
import { memo } from "react";
import type { LgirNode } from "../types";

export type GroupFlowData = LgirNode & {
  memberCount: number;
};

type GroupFlowNode = Node<GroupFlowData, "group">;

export const GroupNode = memo(function GroupNode({ data, selected }: NodeProps<GroupFlowNode>) {
  const parallel = data.config?.execution !== "sequential";
  const ExecutionIcon = parallel ? GitMerge : Layers3;
  const exit = data.config?.exit === "serialize" ? "serialize" : "aggregate";

  return (
    <section className={`group-node ${selected ? "selected" : ""}`} aria-label={`Group: ${data.name}`}>
      <Handle id="input" type="target" position={Position.Left} className="group-handle group-input-handle" />
      <Handle id="dispatch" type="source" position={Position.Left} className="group-handle group-dispatch-handle" />
      <Handle id="collect" type="target" position={Position.Right} className="group-handle group-collect-handle" />
      <Handle id="output" type="source" position={Position.Right} className="group-handle group-output-handle" />
      <header>
        <span className="group-kicker">Group</span>
        <strong>{data.name}</strong>
        <span className="group-mode">
          <ExecutionIcon size={13} /> {parallel ? "parallel" : "sequential"}
        </span>
      </header>
      <p>{data.summary}</p>
      <div className="group-port-label group-input-label">input</div>
      <div className="group-port-label group-exit-label">
        <Braces size={12} /> {exit}
      </div>
      {!data.memberCount && <div className="group-empty">Select this group, then add primitives from the library</div>}
      <footer>
        {data.memberCount} {data.memberCount === 1 ? "member" : "members"} · {exit} exit
      </footer>
    </section>
  );
});
