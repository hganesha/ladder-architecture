import { describe, expect, it } from "vitest";
import { autoLayout, GRID_LAYOUT } from "../src/lib/layout";
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
});
