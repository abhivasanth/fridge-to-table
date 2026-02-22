import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChefGrid } from "@/components/ChefGrid";

describe("ChefGrid", () => {
  it("renders all 8 chefs", () => {
    render(<ChefGrid selectedIds={[]} onChange={() => {}} />);
    expect(screen.getByText("Gordon Ramsay")).toBeInTheDocument();
    expect(screen.getByText("Maangchi")).toBeInTheDocument();
    expect(screen.getByText("Pati Jinich")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(8);
  });

  it("calls onChange with added chef ID when clicking unselected chef", () => {
    const onChange = vi.fn();
    render(<ChefGrid selectedIds={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Gordon Ramsay"));
    expect(onChange).toHaveBeenCalledWith(["gordon-ramsay"]);
  });

  it("calls onChange with chef removed when clicking selected chef", () => {
    const onChange = vi.fn();
    render(<ChefGrid selectedIds={["gordon-ramsay"]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Gordon Ramsay"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows selected count", () => {
    render(<ChefGrid selectedIds={["gordon-ramsay", "maangchi"]} onChange={() => {}} />);
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });
});
