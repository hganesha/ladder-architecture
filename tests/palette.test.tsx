import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Palette } from "../src/components/Palette";
import { ROLE_TEMPLATES } from "../src/lib/roleTemplates";
import { useStudioStore } from "../src/store/useStudioStore";

describe("agent template palette", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useStudioStore.setState({ analysis: null, selectedNodeId: null });
  });

  it("surfaces the expanded role count and researched specialists", () => {
    render(<Palette />);

    expect(ROLE_TEMPLATES).toHaveLength(68);
    expect(screen.getByText("68 agents")).toBeInTheDocument();
    expect(screen.getByText("Requirements Analyst")).toBeInTheDocument();
    expect(screen.getByText("Penetration Tester / Red Team Operator")).toBeInTheDocument();
    expect(screen.getByText("Building Architect / Design Architect")).toBeInTheDocument();
  });

  it("finds a researched role through the visible library search", () => {
    render(<Palette />);

    fireEvent.change(screen.getByPlaceholderText("Search library"), { target: { value: "DFIR" } });

    expect(screen.getByText("DFIR Specialist")).toBeInTheDocument();
    expect(screen.queryByText("Requirements Analyst")).not.toBeInTheDocument();
    expect(screen.getByText("Agent templates · 1")).toBeInTheDocument();
  });
});
