import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "../src/components/Welcome";
import { WORKFLOW_TEMPLATES } from "../src/lib/templates";
import { useStudioStore } from "../src/store/useStudioStore";

vi.mock("../src/lib/persistence", () => ({
  listProjects: vi.fn(async () => []),
  saveProject: vi.fn(async () => ({ id: "test-project", updatedAt: Date.now() })),
  requestPersistentStorage: vi.fn(async () => false),
}));

describe("welcome gallery", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "light";
    useStudioStore.setState({ view: "gallery", analysis: null, projectId: null });
  });

  it("switches workflow category tabs and opens a template", () => {
    const openTemplate = vi.fn(async () => undefined);
    useStudioStore.setState({ openTemplate });
    render(<Welcome onBlank={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Starter workflows" })).toBeInTheDocument();
    expect(screen.getByText(`${WORKFLOW_TEMPLATES.length} workflows across 9 areas`, { exact: false })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(9);
    expect(screen.getByRole("tab", { name: "Core patterns" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("button", { name: /open .* in studio/i })).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Software engineering" }));
    expect(screen.getByRole("tab", { name: "Software engineering" })).toHaveAttribute("aria-selected", "true");
    const templateButtons = screen.getAllByRole("button", { name: /open .* in studio/i });
    expect(templateButtons).toHaveLength(WORKFLOW_TEMPLATES.filter((template) => template.area === "Software engineering").length);
    fireEvent.click(templateButtons[0]);
    expect(openTemplate).toHaveBeenCalledTimes(1);
  });

  it("states the no-account, no-runtime promise", () => {
    render(<Welcome onBlank={() => undefined} />);
    expect(screen.getByText(/no account/i)).toBeInTheDocument();
    expect(screen.getByText(/never runs agents/i)).toBeInTheDocument();
  });

  it("exposes the new multimodal and architecture workflow areas", () => {
    render(<Welcome onBlank={() => undefined} />);

    fireEvent.click(screen.getByRole("tab", { name: "Multimodal" }));
    expect(screen.getByRole("button", { name: /open multimodal asset production in studio/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Architecture & design" }));
    expect(screen.getByRole("button", { name: /open coordinated building design in studio/i })).toBeInTheDocument();
  });

  it("switches themes and remembers the choice", () => {
    render(<Welcome onBlank={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("ladder-graph-theme")).toBe("dark");
  });
});
