import dagre from "@dagrejs/dagre";
import type { LgirEdge, LgirNode } from "../types";

export const GRID_LAYOUT = {
  nodeWidth: 246,
  nodeHeight: 138,
  columnStep: 300,
  rowStep: 200,
  marginX: 100,
  marginY: 50,
} as const;

function dependencyRanks(nodes: LgirNode[], edges: LgirEdge[]) {
  const ids = new Set(nodes.map((node) => node.id));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const ranks = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    outgoing.get(edge.from)?.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    const nextIds = [...(outgoing.get(id) ?? [])].sort((left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0));
    for (const nextId of nextIds) {
      ranks.set(nextId, Math.max(ranks.get(nextId) ?? 0, (ranks.get(id) ?? 0) + 1));
      const remaining = (incoming.get(nextId) ?? 1) - 1;
      incoming.set(nextId, remaining);
      if (remaining === 0) queue.push(nextId);
    }
  }

  return ranks;
}

export function autoLayout(nodes: LgirNode[], edges: LgirEdge[]): LgirNode[] {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    ranksep: GRID_LAYOUT.columnStep - GRID_LAYOUT.nodeWidth,
    nodesep: GRID_LAYOUT.rowStep - GRID_LAYOUT.nodeHeight,
    marginx: GRID_LAYOUT.marginX,
    marginy: GRID_LAYOUT.marginY,
    ranker: "network-simplex",
  });
  nodes.forEach((node) => {
    graph.setNode(node.id, { width: GRID_LAYOUT.nodeWidth, height: GRID_LAYOUT.nodeHeight });
  });
  edges.forEach((edge) => {
    if (graph.hasNode(edge.from) && graph.hasNode(edge.to)) graph.setEdge(edge.from, edge.to);
  });
  dagre.layout(graph);

  const ranks = dependencyRanks(nodes, edges);
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
  const neighbors = new Map(nodes.map((node) => [node.id, { incoming: [] as string[], outgoing: [] as string[] }]));
  for (const edge of edges) {
    neighbors.get(edge.from)?.outgoing.push(edge.to);
    neighbors.get(edge.to)?.incoming.push(edge.from);
  }
  const neighborSignature = (id: string) => {
    const nodeNeighbors = neighbors.get(id);
    return `${[...(nodeNeighbors?.incoming ?? [])].sort().join(",")}|${[...(nodeNeighbors?.outgoing ?? [])].sort().join(",")}`;
  };
  const columns = new Map<number, LgirNode[]>();
  for (const node of nodes) {
    const rank = ranks.get(node.id) ?? 0;
    columns.set(rank, [...(columns.get(rank) ?? []), node]);
  }

  for (const column of columns.values()) {
    column.sort((left, right) => {
      if (neighborSignature(left.id) === neighborSignature(right.id)) {
        return (nodeOrder.get(left.id) ?? 0) - (nodeOrder.get(right.id) ?? 0);
      }
      const leftY = graph.node(left.id)?.y ?? 0;
      const rightY = graph.node(right.id)?.y ?? 0;
      return leftY - rightY || (nodeOrder.get(left.id) ?? 0) - (nodeOrder.get(right.id) ?? 0);
    });
  }

  const maxRows = Math.max(1, ...[...columns.values()].map((column) => column.length));
  const centerY = GRID_LAYOUT.marginY + ((maxRows - 1) * GRID_LAYOUT.rowStep) / 2;
  const positions = new Map<string, { x: number; y: number }>();
  for (const [rank, column] of columns) {
    column.forEach((node, row) => {
      positions.set(node.id, {
        x: GRID_LAYOUT.marginX + rank * GRID_LAYOUT.columnStep,
        y: centerY + (row - (column.length - 1) / 2) * GRID_LAYOUT.rowStep,
      });
    });
  }

  return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position ?? { x: 0, y: 0 } }));
}
