import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterPills } from "@/components/v3/FilterPills";

describe("FilterPills", () => {
  it("renders collapsed by default (pills not visible)", () => {
    render(<FilterPills activeFilters={[]} onChange={vi.fn()} />);
    expect(screen.queryByText("Under 30 mins")).not.toBeInTheDocument();
    expect(screen.getByText("Filters (optional)")).toBeInTheDocument();
  });

  it("expands to show 4 pills when toggle button is tapped", () => {
    render(<FilterPills activeFilters={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("Filters (optional)"));
    expect(screen.getByText("Under 30 mins")).toBeInTheDocument();
    expect(screen.getByText("Spicy")).toBeInTheDocument();
    expect(screen.getByText("Comfort food")).toBeInTheDocument();
    expect(screen.getByText("Low carb")).toBeInTheDocument();
  });

  it("calls onChange with tag added when inactive pill is tapped", () => {
    const onChange = vi.fn();
    render(<FilterPills activeFilters={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Filters (optional)"));
    fireEvent.click(screen.getByText("Spicy"));
    expect(onChange).toHaveBeenCalledWith(["spicy"]);
  });

  it("calls onChange with tag removed when active pill is tapped again", () => {
    const onChange = vi.fn();
    render(<FilterPills activeFilters={["spicy"]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Filters (optional)"));
    fireEvent.click(screen.getByText("Spicy"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows active count badge when filters are active", () => {
    render(<FilterPills activeFilters={["spicy", "under-30"]} onChange={vi.fn()} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
