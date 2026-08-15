import {
  Background,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import "@xyflow/react/dist/style.css";
import { NODE_META } from "../lib/nodeMeta";
import { useStudioStore } from "../store/useStudioStore";
import type { LgirEdge, LgirNode } from "../types";
import { TaskNode } from "./TaskNode";

type TaskFlowNode = Node<LgirNode, "task">;

function toFlowNodes(nodes: LgirNode[]): TaskFlowNode[] {
  return nodes.map((node) => ({ id: node.id, type: "task", position: node.position ?? { x: 0, y: 0 }, data: node }));
}

function toFlowEdges(edges: LgirEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: "smoothstep",
    label: edge.contract || edge.condition,
    animated: edge.kind === "control",
    style: {
      stroke: edge.kind === "data" ? "var(--cyan)" : edge.kind === "control" ? "var(--pink)" : "var(--edge-dependency)",
      strokeWidth: 1.35,
    },
    labelStyle: { fill: "var(--edge-label)", fontSize: 11 },
    labelBgStyle: { fill: "var(--edge-label-bg)", fillOpacity: 0.94 },
  }));
}

const nodeTypes = { task: TaskNode };

export function GraphCanvas() {
  const workflow = useStudioStore((state) => state.analysis?.normalized);
  const validYaml = Boolean(workflow);
  const selectNode = useStudioStore((state) => state.selectNode);
  const selectedNodeId = useStudioStore((state) => state.selectedNodeId);
  const connect = useStudioStore((state) => state.connect);
  const updatePositions = useStudioStore((state) => state.updatePositions);
  const sourceNodes = useMemo(() => toFlowNodes(workflow?.spec.nodes ?? []), [workflow]);
  const sourceEdges = useMemo(() => toFlowEdges(workflow?.spec.edges ?? []), [workflow]);
  const [nodes, setNodes, onNodesChange] = useNodesState<TaskFlowNode>(sourceNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(sourceEdges);

  useEffect(() => setNodes(sourceNodes), [sourceNodes, setNodes]);
  useEffect(() => setEdges(sourceEdges), [sourceEdges, setEdges]);

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    void connect({ from: connection.source, to: connection.target, kind: "dependency" });
  };

  return (
    <section className="canvas-wrap" aria-label="Workflow graph canvas">
      {!validYaml && (
        <div className="canvas-lock">
          <AlertContent />
        </div>
      )}
      <ReactFlow
        nodes={nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId }))}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        onNodeDragStop={(_, node) => void updatePositions({ [node.id]: node.position })}
        nodesDraggable={validYaml}
        nodesConnectable={validYaml}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.66,
          maxZoom: 1,
          nodes: sourceNodes.slice(0, Math.min(4, sourceNodes.length)),
        }}
        minZoom={0.25}
        maxZoom={1.7}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--graph-grid)" gap={25} size={1} />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => NODE_META[(node.data as unknown as LgirNode).kind]?.color ?? "#66717c"}
          maskColor="var(--minimap-mask)"
          pannable
          zoomable
        />
      </ReactFlow>
      <div className="canvas-hint">drag nodes · connect handles · ⌘↵ compile</div>
    </section>
  );
}

function AlertContent() {
  return (
    <>
      <strong>Canvas paused</strong>
      <span>Fix the YAML syntax to resume visual editing. Your last valid graph is still saved.</span>
    </>
  );
}
