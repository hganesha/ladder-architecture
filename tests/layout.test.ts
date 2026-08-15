import { describe, expect, it } from "vitest";
import { autoLayout, GRID_LAYOUT, groupDimensions } from "../src/lib/layout";
import type { LgirEdge, LgirNode } from "../src/types";

const nodes: LgirNode[] = [
  { id: "input", kind: "input", name: "Input" },
  { id: "design", kind: "agent", name: "Design" },
  { id: "architecture", kind: "agent", name: "Architecture" },
  { id: "join", kind: "join", name: "Join" },
  { id: "gate", kind: "evaluate", name: "Gate" },
  { id: "output", kind: "output", name: "Output" },
];

const edges: LgirEdge[] = [
  { id: "e1", from: "input", to: "design", kind: "dependency" },
  { id: "e2", from: "input", to: "architecture", kind: "dependency" },
  { id: "e3", from: "design", to: "join", kind: "dependency" },
  { id: "e4", from: "architecture", to: "join", kind: "dependency" },
  { id: "e5", from: "join", to: "gate", kind: "dependency" },
  { id: "e6", from: "gate", to: "output", kind: "dependency" },
];

function positions() {
  return Object.fromEntries(autoLayout(nodes, edges).map((node) => [node.id, node.position]));
}

describe("grid auto-layout", () => {
  it("aligns dependency phases to fixed columns and parallel work to fixed rows", () => {
    const result = positions();

    expect(result.design?.x).toBe(result.architecture?.x);
    expect(Math.abs((result.design?.y ?? 0) - (result.architecture?.y ?? 0))).toBe(GRID_LAYOUT.rowStep);
    expect((result.design?.x ?? 0) - (result.input?.x ?? 0)).toBe(GRID_LAYOUT.columnStep);
    expect((result.join?.x ?? 0) - (result.design?.x ?? 0)).toBe(GRID_LAYOUT.columnStep);
    expect(result.input?.y).toBe(result.join?.y);
    expect(result.join?.y).toBe(result.gate?.y);
    expect(result.gate?.y).toBe(result.output?.y);
  });

  it("is deterministic and snaps every node to the visual grid", () => {
    const first = positions();
    const second = positions();

    expect(first).toEqual(second);
    for (const position of Object.values(first)) {
      expect((position?.x ?? 0) % 25).toBe(0);
      expect((position?.y ?? 0) % 25).toBe(0);
    }
  });

  it("places grouped children inside their visual bounding box", () => {
    const grouped: LgirNode[] = [
      { id: "input", kind: "input", name: "Input" },
      {
        id: "group",
        kind: "group",
        name: "Parallel group",
        config: { members: ["design", "architecture"], execution: "parallel", exit: "aggregate" },
      },
      { id: "design", kind: "agent", name: "Design" },
      { id: "architecture", kind: "agent", name: "Architecture" },
      { id: "output", kind: "output", name: "Output" },
    ];
    const groupedEdges: LgirEdge[] = [
      { id: "e1", from: "input", to: "group", kind: "data" },
      { id: "e2", from: "group", to: "output", kind: "data" },
    ];
    const result = new Map(autoLayout(grouped, groupedEdges).map((node) => [node.id, node]));
    const group = result.get("group");
    const dimensions = groupDimensions(grouped[1]);
    if (!group?.position) throw new Error("Group layout is missing a position.");
    for (const id of ["design", "architecture"]) {
      const position = result.get(id)?.position;
      expect(position?.x).toBeGreaterThan(group.position.x);
      expect(position?.y).toBeGreaterThan(group.position.y);
      expect((position?.x ?? 0) + GRID_LAYOUT.nodeWidth).toBeLessThan(group.position.x + dimensions.width);
      expect((position?.y ?? 0) + GRID_LAYOUT.nodeHeight).toBeLessThan(group.position.y + dimensions.height);
    }
    expect(result.get("output")?.position?.x ?? 0).toBeGreaterThan(group.position.x + dimensions.width);
  });
});
