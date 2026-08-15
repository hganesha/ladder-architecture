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

export function groupDimensions(node: LgirNode) {
  const count = node.config?.members?.length ?? 0;
  if (node.config?.execution === "sequential") {
    return { width: Math.max(500, Math.ceil((75 + Math.max(1, count) * 275 + 75) / 25) * 25), height: 300 };
  }
  return { width: 550, height: Math.max(300, Math.ceil((75 + Math.max(1, count) * 175 + 50) / 25) * 25) };
}

export function groupMemberPosition(group: LgirNode, index: number) {
  return group.config?.execution === "sequential" ? { x: 75 + index * 275, y: 100 } : { x: 125, y: 75 + index * 175 };
}

function collapsedGraph(nodes: LgirNode[], edges: LgirEdge[]) {
  const groups = nodes.filter((node) => node.kind === "group");
  const owner = new Map<string, string>();
  groups.forEach((group) => {
    group.config?.members?.forEach((id) => {
      owner.set(id, group.id);
    });
  });
  const topLevel = nodes.filter((node) => !owner.has(node.id));
  const seen = new Set<string>();
  const collapsedEdges = edges.flatMap((edge) => {
    const from = owner.get(edge.from) ?? edge.from;
    const to = owner.get(edge.to) ?? edge.to;
    const key = `${from}:${to}`;
    if (from === to || seen.has(key)) return [];
    seen.add(key);
    return [{ ...edge, from, to }];
  });
  return { groups, owner, topLevel, collapsedEdges };
}

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
  const { groups, owner, topLevel, collapsedEdges } = collapsedGraph(nodes, edges);
  const layoutNodes = groups.length ? topLevel : nodes;
  const layoutEdges = groups.length ? collapsedEdges : edges;
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    ranksep: GRID_LAYOUT.columnStep - GRID_LAYOUT.nodeWidth,
    nodesep: GRID_LAYOUT.rowStep - GRID_LAYOUT.nodeHeight,
    marginx: GRID_LAYOUT.marginX,
    marginy: GRID_LAYOUT.marginY,
    ranker: "network-simplex",
  });
  layoutNodes.forEach((node) => {
    const dimensions = node.kind === "group" ? groupDimensions(node) : { width: GRID_LAYOUT.nodeWidth, height: GRID_LAYOUT.nodeHeight };
    graph.setNode(node.id, dimensions);
  });
  layoutEdges.forEach((edge) => {
    if (graph.hasNode(edge.from) && graph.hasNode(edge.to)) graph.setEdge(edge.from, edge.to);
  });
  dagre.layout(graph);

  const ranks = dependencyRanks(layoutNodes, layoutEdges);
  const nodeOrder = new Map(layoutNodes.map((node, index) => [node.id, index]));
  const neighbors = new Map(layoutNodes.map((node) => [node.id, { incoming: [] as string[], outgoing: [] as string[] }]));
  for (const edge of layoutEdges) {
    neighbors.get(edge.from)?.outgoing.push(edge.to);
    neighbors.get(edge.to)?.incoming.push(edge.from);
  }
  const neighborSignature = (id: string) => {
    const nodeNeighbors = neighbors.get(id);
    return `${[...(nodeNeighbors?.incoming ?? [])].sort().join(",")}|${[...(nodeNeighbors?.outgoing ?? [])].sort().join(",")}`;
  };
  const columns = new Map<number, LgirNode[]>();
  for (const node of layoutNodes) {
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

  const columnWidths = new Map(
    [...columns].map(([rank, column]) => [
      rank,
      Math.max(...column.map((node) => (node.kind === "group" ? groupDimensions(node).width : GRID_LAYOUT.nodeWidth))),
    ]),
  );
  const columnHeights = [...columns.values()].map((column) =>
    column.reduce(
      (total, node, index) =>
        total +
        (node.kind === "group" ? groupDimensions(node).height : GRID_LAYOUT.nodeHeight) +
        (index ? GRID_LAYOUT.rowStep - GRID_LAYOUT.nodeHeight : 0),
      0,
    ),
  );
  const centerY = GRID_LAYOUT.marginY + Math.max(GRID_LAYOUT.nodeHeight, ...columnHeights) / 2;
  const positions = new Map<string, { x: number; y: number }>();
  for (const [rank, column] of columns) {
    const previousWidth = [...columnWidths.entries()]
      .filter(([candidate]) => candidate < rank)
      .sort(([left], [right]) => left - right)
      .reduce((total, [, width]) => total + width + (GRID_LAYOUT.columnStep - GRID_LAYOUT.nodeWidth), 0);
    const heights = column.map((node) => (node.kind === "group" ? groupDimensions(node).height : GRID_LAYOUT.nodeHeight));
    const totalHeight =
      heights.reduce((total, height) => total + height, 0) +
      Math.max(0, column.length - 1) * (GRID_LAYOUT.rowStep - GRID_LAYOUT.nodeHeight);
    let cursorY = centerY - totalHeight / 2;
    column.forEach((node, row) => {
      const height = heights[row];
      positions.set(node.id, {
        x: GRID_LAYOUT.marginX + previousWidth,
        y: Math.round(cursorY / 25) * 25,
      });
      cursorY += height + (GRID_LAYOUT.rowStep - GRID_LAYOUT.nodeHeight);
    });
  }

  const groupById = new Map(groups.map((group) => [group.id, group]));
  return nodes.map((node) => {
    const groupId = owner.get(node.id);
    if (!groupId) return { ...node, position: positions.get(node.id) ?? node.position ?? { x: 0, y: 0 } };
    const group = groupById.get(groupId);
    const groupPosition = positions.get(groupId) ?? group?.position ?? { x: 0, y: 0 };
    const index = group?.config?.members?.indexOf(node.id) ?? 0;
    const relative = group ? groupMemberPosition(group, index) : { x: 0, y: 0 };
    return { ...node, position: { x: groupPosition.x + relative.x, y: groupPosition.y + relative.y } };
  });
}
