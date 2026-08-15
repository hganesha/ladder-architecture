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
import { useEffect, useMemo, useRef } from "react";
import "@xyflow/react/dist/style.css";
import { groupDimensions } from "../lib/layout";
import { NODE_META } from "../lib/nodeMeta";
import { useStudioStore } from "../store/useStudioStore";
import type { LgirEdge, LgirNode } from "../types";
import { type GroupFlowData, GroupNode } from "./GroupNode";
import { TaskNode } from "./TaskNode";

type TaskFlowNode = Node<LgirNode, "task">;
type GroupFlowNode = Node<GroupFlowData, "group">;
type WorkflowFlowNode = TaskFlowNode | GroupFlowNode;

function toFlowNodes(nodes: LgirNode[]): WorkflowFlowNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const owner = new Map<string, LgirNode>();
  nodes
    .filter((node) => node.kind === "group")
    .forEach((group) => {
      group.config?.members?.forEach((id) => {
        owner.set(id, group);
      });
    });
  return [...nodes]
    .sort((left, right) => Number(left.kind !== "group") - Number(right.kind !== "group"))
    .map((node) => {
      const position = node.position ?? { x: 0, y: 0 };
      if (node.kind === "group") {
        const dimensions = groupDimensions(node);
        return {
          id: node.id,
          type: "group",
          position,
          data: { ...node, memberCount: node.config?.members?.filter((id) => byId.has(id)).length ?? 0 },
          style: dimensions,
          zIndex: -1,
        } satisfies GroupFlowNode;
      }
      const group = owner.get(node.id);
      const groupPosition = group?.position ?? { x: 0, y: 0 };
      return {
        id: node.id,
        type: "task",
        position: group ? { x: position.x - groupPosition.x, y: position.y - groupPosition.y } : position,
        data: node,
        parentId: group?.id,
        extent: group ? "parent" : undefined,
        zIndex: 2,
      } satisfies TaskFlowNode;
    });
}

function toFlowEdges(edges: LgirEdge[], nodes: LgirNode[]): Edge[] {
  const stored = edges.map((edge) => ({
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
  const virtual = nodes
    .filter((node) => node.kind === "group")
    .flatMap((group) => {
      const members = group.config?.members?.filter((id) => nodes.some((node) => node.id === id)) ?? [];
      if (!members.length) return [];
      const executionEdges =
        group.config?.execution === "sequential"
          ? [
              { id: `group-${group.id}-dispatch`, source: group.id, sourceHandle: "dispatch", target: members[0] },
              ...members
                .slice(1)
                .map((member, index) => ({ id: `group-${group.id}-sequence-${index}`, source: members[index], target: member })),
            ]
          : members.map((member) => ({
              id: `group-${group.id}-dispatch-${member}`,
              source: group.id,
              sourceHandle: "dispatch",
              target: member,
            }));
      const collectionEdges = members.map((member) => ({
        id: `group-${group.id}-collect-${member}`,
        source: member,
        target: group.id,
        targetHandle: "collect",
      }));
      return [...executionEdges, ...collectionEdges].map((edge) => ({
        ...edge,
        type: "smoothstep",
        selectable: false,
        focusable: false,
        className: "group-internal-edge",
        style: { stroke: "var(--group-edge)", strokeWidth: 1.1, strokeDasharray: "4 4" },
      }));
    });
  return [...stored, ...virtual];
}

const nodeTypes = { task: TaskNode, group: GroupNode };

export function GraphCanvas() {
  const workflow = useStudioStore((state) => state.analysis?.normalized);
  const validYaml = Boolean(workflow);
  const selectNode = useStudioStore((state) => state.selectNode);
  const selectedNodeId = useStudioStore((state) => state.selectedNodeId);
  const connect = useStudioStore((state) => state.connect);
  const updatePositions = useStudioStore((state) => state.updatePositions);
  const sourceNodes = useMemo(() => toFlowNodes(workflow?.spec.nodes ?? []), [workflow]);
  const sourceEdges = useMemo(() => toFlowEdges(workflow?.spec.edges ?? [], workflow?.spec.nodes ?? []), [workflow]);
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>(sourceNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(sourceEdges);
  const fitAddedNodes = useRef<(() => void) | null>(null);
  const previousNodeCount = useRef(sourceNodes.length);

  useEffect(() => setNodes(sourceNodes), [sourceNodes, setNodes]);
  useEffect(() => setEdges(sourceEdges), [sourceEdges, setEdges]);
  useEffect(() => {
    const added = sourceNodes.length > previousNodeCount.current;
    previousNodeCount.current = sourceNodes.length;
    if (!added) return;
    const frame = requestAnimationFrame(() => {
      fitAddedNodes.current?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [sourceNodes.length]);

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
        onInit={(instance) => {
          fitAddedNodes.current = () => {
            void instance.fitView({ padding: 0.15, minZoom: 0.45, maxZoom: 0.9, duration: 220 });
          };
        }}
        onNodeDragStop={(_, node) => {
          const source = workflow?.spec.nodes.find((candidate) => candidate.id === node.id);
          if (!source) return;
          if (source.kind === "group") {
            const previous = source.position ?? { x: 0, y: 0 };
            const delta = { x: node.position.x - previous.x, y: node.position.y - previous.y };
            const positions = Object.fromEntries(
              [source.id, ...(source.config?.members ?? [])].map((id) => {
                const member = workflow?.spec.nodes.find((candidate) => candidate.id === id);
                const position = member?.position ?? previous;
                return [id, id === source.id ? node.position : { x: position.x + delta.x, y: position.y + delta.y }];
              }),
            );
            void updatePositions(positions);
            return;
          }
          const parent = workflow?.spec.nodes.find(
            (candidate) => candidate.kind === "group" && candidate.config?.members?.includes(node.id),
          );
          const parentPosition = parent?.position ?? { x: 0, y: 0 };
          void updatePositions({
            [node.id]: parent ? { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y } : node.position,
          });
        }}
        nodesDraggable={validYaml}
        nodesConnectable={validYaml}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.45,
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
      <div className="canvas-hint">
        <span className="desktop-canvas-hint">drag nodes · connect handles · ⌘↵ compile</span>
        <span className="mobile-canvas-hint">drag to pan · pinch to zoom</span>
      </div>
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
